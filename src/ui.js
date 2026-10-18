import { DIFFICULTIES, score, validateGuess, randomSecret } from './game.js';
import { dailyNumber, dailySecret, msUntilNextDay, DAILY_EPOCH, DAILY_LENGTH, DAILY_MAX } from './daily.js';
import { emptyStats, recordResult, displayStreak } from './stats.js';
import { shareText } from './share.js';
import { totalCandidates, remainingCounts } from './analysis.js';
import { formatDuration } from './time.js';
import { load, save } from './storage.js';

const KEYS = {
  stats: '1a2b:v1:stats',
  difficulty: '1a2b:v1:difficulty',
  repeats: '1a2b:v1:repeats',
  archive: '1a2b:v1:archive', // { [day]: { guesses, marks, elapsed } } for every daily puzzle touched
  daily: '1a2b:v1:daily',
  seenHelp: '1a2b:v1:seenHelp',
};

const MARK_CYCLE = { unknown: 'present', present: 'absent', absent: 'unknown' };
const MARK_LABEL = { unknown: '', present: '（一定有）', absent: '（一定沒有）' };
const LONG_PRESS_MS = 500;

const ERRORS = {
  length: (n) => `請輸入 ${n} 位數字`,
  repeated: () => '這組已經猜過了',
};

const $ = (id) => document.getElementById(id);

// ---------- state ----------

let difficulty = load(KEYS.difficulty, 'normal');
if (!DIFFICULTIES[difficulty]) difficulty = 'normal';
// practice variant: answers may repeat digits (the daily puzzle never does)
let repeats = load(KEYS.repeats, false) === true;

// Initialised at the bottom of the file, once every helper is defined.
let stats;
const games = { daily: null, practice: null };
let game;
let markMode = false;
let celebrateNext = false;

function validStats(s, maxGuesses) {
  return (
    s && typeof s === 'object' &&
    typeof s.played === 'number' && typeof s.wins === 'number' &&
    Array.isArray(s.dist) && s.dist.length === maxGuesses + 1
  );
}

// Practice stats are kept per difficulty and variant: "normal", "normal-repeat", …
const statsKey = (diff, rep) => (rep ? `${diff}-repeat` : diff);

function loadStats() {
  const raw = load(KEYS.stats, {});
  const limits = { daily: DAILY_MAX };
  for (const [diff, { maxGuesses }] of Object.entries(DIFFICULTIES)) {
    limits[statsKey(diff, false)] = maxGuesses;
    limits[statsKey(diff, true)] = maxGuesses;
  }
  const out = {};
  for (const [kind, maxGuesses] of Object.entries(limits)) {
    out[kind] = validStats(raw[kind], maxGuesses) ? raw[kind] : emptyStats(maxGuesses);
  }
  return out;
}

const freshMarks = () => Array(10).fill('unknown');

function blankGame(fields) {
  return {
    guesses: [], results: [], marks: freshMarks(), input: '', over: false, won: false,
    elapsed: 0, runningSince: null, // play time in ms; the clock runs only while visible
    ...fields,
  };
}

function newPractice(diff, rep) {
  const { length, maxGuesses } = DIFFICULTIES[diff];
  return blankGame({
    kind: 'practice', difficulty: diff, repeats: rep, length, maxGuesses,
    secret: randomSecret(length, Math.random, rep),
  });
}

function dailyGame(kind, day) {
  return blankGame({ kind, day, length: DAILY_LENGTH, maxGuesses: DAILY_MAX, secret: dailySecret(day) });
}

// Replays saved guesses (dropping anything invalid) and restores marks/time.
function restoreProgress(g, saved) {
  if (!saved || !Array.isArray(saved.guesses)) return g;
  for (const guess of saved.guesses.slice(0, g.maxGuesses)) {
    if (g.over || typeof guess !== 'string' || !/^\d+$/.test(guess) || !validateGuess(guess, g.length, g.guesses).ok) break;
    applyGuess(g, guess);
  }
  if (Array.isArray(saved.marks) && saved.marks.length === 10) g.marks = saved.marks;
  if (Number.isFinite(saved.elapsed) && saved.elapsed > 0) g.elapsed = saved.elapsed;
  return g;
}

// A saved daily game from another day is dropped unrecorded (the streak
// breaks on its own because that day has no win); it stays playable from
// the archive, which mirrors every daily save.
function loadDaily(day) {
  const g = dailyGame('daily', day);
  g.recorded = false;
  const saved = load(KEYS.daily, {});
  if (saved.day !== day) return g;
  restoreProgress(g, saved);
  g.recorded = saved.recorded === true;
  if (g.over && !g.recorded) recordFinish(g);
  return g;
}

function dailyRecordedElsewhere(g) {
  const saved = load(KEYS.daily, {});
  return saved.day === g.day && saved.recorded === true;
}

function saveDaily(g) {
  // never clear a "recorded" flag another tab already wrote for this day
  const recorded = g.recorded || dailyRecordedElsewhere(g);
  save(KEYS.daily, { day: g.day, guesses: g.guesses, marks: g.marks, elapsed: elapsedOf(g), recorded });
}

const loadArchive = () => load(KEYS.archive, {});

// Replays of past daily puzzles never touch stats or streaks.
function loadArchiveGame(day) {
  return restoreProgress(dailyGame('archive', day), loadArchive()[day]);
}

function saveToArchive(g) {
  const archive = loadArchive();
  archive[g.day] = { guesses: g.guesses, marks: g.marks, elapsed: elapsedOf(g) };
  save(KEYS.archive, archive);
}

// Saves whatever kind of game this is (practice games are not saved).
function persist(g) {
  if (g.kind === 'daily') saveDaily(g);
  if (g.kind === 'daily' || g.kind === 'archive') saveToArchive(g);
}

const inProgress = (g) => g.guesses.length > 0 && !g.over;

// ---------- play clock ----------

const elapsedOf = (g) => g.elapsed + (g.runningSince === null ? 0 : Date.now() - g.runningSince);
const clockStarted = (g) => g.elapsed > 0 || g.runningSince !== null || g.guesses.length > 0;

function startClock(g) {
  if (!g.over && g.runningSince === null && !document.hidden) g.runningSince = Date.now();
}

function pauseClock(g) {
  if (g.runningSince === null) return;
  g.elapsed = elapsedOf(g);
  g.runningSince = null;
}

// only the game on screen runs its clock
function resumeClockIfStarted(g) {
  if (clockStarted(g)) startClock(g);
}

// ---------- game rules applied to state ----------

function applyGuess(g, guess) {
  const result = score(g.secret, guess);
  g.guesses.push(guess);
  g.results.push(result);
  if (result.a === g.length) {
    g.over = true;
    g.won = true;
  } else if (g.guesses.length >= g.maxGuesses) {
    g.over = true;
  }
  return result;
}

function recordFinish(g) {
  if (g.kind === 'archive') return;
  // Another tab may have saved newer stats since this page loaded: build on
  // what is stored, not on this tab's copy, or that tab's result is lost.
  stats = loadStats();
  const result = { won: g.won, guesses: g.guesses.length, timeMs: g.elapsed > 0 ? g.elapsed : undefined };
  if (g.kind === 'daily') {
    if (g.recorded || dailyRecordedElsewhere(g)) {
      g.recorded = true;
      return;
    }
    stats.daily = recordResult(stats.daily, { ...result, dayNumber: g.day });
    g.recorded = true;
    saveDaily(g);
  } else {
    const key = statsKey(g.difficulty, g.repeats);
    stats[key] = recordResult(stats[key], result);
  }
  save(KEYS.stats, stats);
}

// ---------- actions ----------

function typeDigit(d) {
  if (game.over) return;
  if (game.input.length >= game.length) return;
  startClock(game);
  game.input += d;
  setMessage('');
  render();
}

function toggleMark(d) {
  if (game.over) return;
  const i = Number(d);
  game.marks[i] = MARK_CYCLE[game.marks[i]] ?? 'present';
  persist(game);
  renderPad();
}

function setMarkMode(on) {
  markMode = on;
  renderPad();
}

function deleteDigit() {
  if (game.over || !game.input) return;
  game.input = game.input.slice(0, -1);
  render();
}

function submit() {
  if (game.over) return;
  const check = validateGuess(game.input, game.length, game.guesses);
  if (!check.ok) {
    setMessage(ERRORS[check.reason](game.length), true);
    shake($('slots'));
    return;
  }
  const result = applyGuess(game, game.input);
  game.input = '';
  if (game.over) {
    pauseClock(game);
    game.finishedDay = dailyNumber(new Date());
  }
  persist(game);
  if (game.over) recordFinish(game);
  celebrateNext = game.won;
  const answer = game.over && !game.won ? `，答案是 ${game.secret}` : '';
  setMessage(`第 ${game.guesses.length} 次：${result.a}A${result.b}B${answer}`);
  render();
  if (game.over && game.kind === 'daily') {
    const finished = game;
    setTimeout(() => { if (game === finished) openStats(); }, 900);
  }
}

function setMode(mode) {
  if (game === games[mode]) return;
  showGame(games[mode]);
  setMessage('');
  render();
}

// Switch the game on screen; only that game's clock runs.
function showGame(g) {
  pauseClock(game);
  persist(game);
  game = g;
  resumeClockIfStarted(game);
}

function chooseDifficulty(diff) {
  if (diff === game.difficulty && !game.over) return;
  if (inProgress(game) && !confirm('放棄目前這局？')) return;
  difficulty = diff;
  save(KEYS.difficulty, difficulty);
  game = games.practice = newPractice(difficulty, repeats);
  setMessage('');
  render();
}

function toggleRepeats() {
  if (inProgress(game) && !confirm('放棄目前這局？')) return;
  repeats = !repeats;
  save(KEYS.repeats, repeats);
  game = games.practice = newPractice(difficulty, repeats);
  setMessage(repeats ? '答案可能有重複數字' : '答案的數字不會重複');
  render();
}

function newGame() {
  if (inProgress(game) && !confirm('放棄目前這局？')) return;
  game = games.practice = newPractice(game.difficulty, game.repeats);
  setMessage('');
  render();
}

function share(e) {
  const button = e?.currentTarget;
  const g = games.daily;
  const url = location.origin + location.pathname;
  const text = shareText(g.day, g.results, g.maxGuesses, url, g.elapsed > 0 ? g.elapsed : undefined);
  const fallback = () => showShareFallback(text);
  if (!navigator.clipboard?.writeText) return fallback();
  navigator.clipboard.writeText(text).then(() => {
    setMessage('已複製戰績，貼給朋友吧！');
    // the message line is hidden behind an open dialog, so confirm on the button too
    if (button) {
      button.textContent = '已複製！';
      setTimeout(() => { button.textContent = '分享'; }, 1500);
    }
  }, fallback);
}

function showShareFallback(text) {
  // inside the stats dialog when it is open, otherwise under the banner
  const host = $('stats-dialog').open ? $('stats-foot') : $('banner');
  let box = $('share-fallback');
  if (!box || box.parentElement !== host) {
    box?.remove();
    box = document.createElement('textarea');
    box.id = 'share-fallback';
    box.className = 'share-fallback';
    box.readOnly = true;
    box.setAttribute('aria-label', '分享文字');
    host.append(box);
  }
  box.value = text;
  box.rows = text.split('\n').length;
  box.focus();
  box.select();
  setMessage('無法自動複製，請手動複製上面的文字');
}

function swapInDaily(today) {
  const wasShowing = game === games.daily;
  games.daily = loadDaily(today);
  if (wasShowing) {
    game = games.daily;
    setMessage('新的一題來了！');
  }
  render();
  if ($('stats-dialog').open) renderStats();
}

// Called every second: keeps the countdown fresh and swaps in the new daily
// puzzle at the first midnight after the daily game was finished. An
// unfinished daily game keeps going until reload, and one finished after
// midnight keeps its result on screen (with a link to today's puzzle).
function tick() {
  const today = dailyNumber(new Date());
  const daily = games.daily;
  if (daily.over && today > (daily.finishedDay ?? daily.day)) {
    swapInDaily(today);
    return;
  }
  const el = $('countdown');
  if (el) el.textContent = formatCountdown(msUntilNextDay(new Date()));
  renderTimer();
}

function renderTimer() {
  $('timer').textContent = `⏱${formatDuration(elapsedOf(game))}`;
}

function formatCountdown(ms) {
  const s = Math.floor(ms / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// ---------- rendering ----------

function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

function setMessage(text, isError = false) {
  const m = $('message');
  m.textContent = text;
  m.classList.toggle('error', isError);
}

function buildDigits() {
  const wrap = $('digits');
  for (const d of '1234567890') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key';
    b.dataset.digit = d;
    b.textContent = d;
    b.setAttribute('aria-label', `數字 ${d}`);
    wrap.append(b);
  }
}

let historyOwner = null;

function renderHistory() {
  const list = $('history');
  if (historyOwner !== game || list.children.length > game.guesses.length) {
    list.replaceChildren();
    historyOwner = game;
  }
  const rendered = list.children.length;
  for (let i = rendered; i < game.guesses.length; i++) {
    const { a, b } = game.results[i];
    const li = document.createElement('li');
    const win = a === game.length;
    li.className = 'row' + (win ? ' win' : '') + (win && celebrateNext ? ' celebrate' : '');
    li.innerHTML = `
      <span class="row-n">${i + 1}.</span>
      <span class="row-digits">${game.guesses[i]}</span>
      <span class="row-result" aria-label="${a}A${b}B">
        <span class="tag tag-a">${a}A</span><span class="tag tag-b">${b}B</span>
      </span>`;
    list.append(li);
  }
  celebrateNext = false;
  renderAnalysis(list);
  $('empty-hint').hidden = game.guesses.length > 0;
  if (list.children.length > rendered) list.lastElementChild.scrollIntoView({ block: 'nearest' });
}

// After the game only (no spoilers): how many answers each guess left open.
function renderAnalysis(list) {
  const note = $('analysis-note');
  note.hidden = !game.over;
  if (!game.over) return;
  game.analysis ??= {
    total: totalCandidates(game.length, !!game.repeats),
    counts: remainingCounts(game.guesses, game.results, game.length, !!game.repeats),
  };
  const { total, counts } = game.analysis;
  note.textContent = `賽後分析：一開始有 ${total.toLocaleString()} 種可能`;
  [...list.children].forEach((li, i) => {
    if (li.querySelector('.row-left')) return;
    const span = document.createElement('span');
    span.className = 'row-left';
    span.textContent = counts[i] === 1 ? '只剩 1 種' : `剩 ${counts[i].toLocaleString()} 種可能`;
    li.append(span);
  });
}

function renderEntry() {
  const slots = $('slots');
  slots.replaceChildren();
  for (let i = 0; i < game.length; i++) {
    const s = document.createElement('span');
    s.className = 'slot' + (game.input[i] ? ' filled' : '');
    s.textContent = game.input[i] ?? '';
    slots.append(s);
  }
  $('count').textContent = `${game.guesses.length}/${game.maxGuesses}`;
  renderTimer();
  $('entry').hidden = game.over;
}

function pill(label, onClick, primary = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pill' + (primary ? ' primary' : '');
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function renderBanner() {
  const banner = $('banner');
  banner.hidden = !game.over;
  $('share-fallback')?.remove();
  if (!game.over) return;
  const time = game.elapsed > 0 ? `　⏱${formatDuration(game.elapsed)}` : '';
  $('banner-text').textContent = (game.won
    ? `🎉 第 ${game.guesses.length} 次猜中！`
    : `答案是 ${game.secret}`) + time;
  const actions = $('banner-actions');
  actions.replaceChildren();
  if (game.kind === 'daily') {
    actions.append(pill('分享', share, true), pill('統計', () => openStats()));
    const today = dailyNumber(new Date());
    if (game.day !== today) {
      actions.append(pill('前往今天的題目', () => swapInDaily(today)));
    } else {
      const next = document.createElement('span');
      next.className = 'next';
      next.innerHTML = '下一題 <span id="countdown"></span>';
      actions.append(next);
      $('countdown').textContent = formatCountdown(msUntilNextDay(new Date()));
    }
  } else if (game.kind === 'archive') {
    actions.append(pill('回到今天', () => openPuzzle(dailyNumber(new Date())), true), pill('過去題目', openArchive));
  } else {
    actions.append(pill('再來一局', newGame, true));
  }
}

function renderPad() {
  for (const key of document.querySelectorAll('.key')) {
    const d = key.dataset.digit;
    const mark = game.marks[Number(d)];
    key.classList.toggle('present', mark === 'present');
    key.classList.toggle('absent', mark === 'absent');
    key.setAttribute('aria-label', `數字 ${d}${MARK_LABEL[mark] ?? ''}`);
    key.disabled = game.over;
  }
  $('mark-btn').setAttribute('aria-pressed', String(markMode));
  $('mark-btn').disabled = game.over;
  document.querySelector('.pad').classList.toggle('marking', markMode && !game.over);
  $('del-btn').disabled = game.over;
  $('enter-btn').disabled = game.over;
}

function renderBars() {
  for (const b of document.querySelectorAll('.mode')) {
    // a replayed past puzzle lives under the 每日 tab
    b.setAttribute('aria-pressed', String(b.dataset.mode === (game.kind === 'archive' ? 'daily' : game.kind)));
  }
  $('difficulty').hidden = game.kind !== 'practice';
  $('daily-bar').hidden = game.kind === 'practice';
  $('today-btn').hidden = game.kind !== 'archive';
  if (game.kind !== 'practice') {
    $('daily-label').textContent = `每日挑戰 #${game.day}${game.kind === 'archive' ? '（補玩）' : ''}`;
  }
  for (const b of document.querySelectorAll('[data-difficulty]')) {
    b.setAttribute('aria-pressed', String(b.dataset.difficulty === game.difficulty));
  }
  $('repeat-toggle').setAttribute('aria-pressed', String(game.kind === 'practice' && game.repeats));
}

function render() {
  renderBars();
  renderHistory();
  renderEntry();
  renderBanner();
  renderPad();
}

// ---------- dialogs ----------

let statsTab = 'daily';
let statsRepeats = false; // which variant the practice tabs show

function openStats(tab = game.kind === 'practice' ? game.difficulty : 'daily') {
  statsTab = tab;
  statsRepeats = games.practice.repeats;
  renderStats();
  const dialog = $('stats-dialog');
  if (!dialog.open) dialog.showModal();
}

function card(value, label) {
  return `<div class="card"><span class="card-value">${value}</span><span class="card-label">${label}</span></div>`;
}

function renderStats() {
  const isDaily = statsTab === 'daily';
  const s = stats[isDaily ? 'daily' : statsKey(statsTab, statsRepeats)];
  for (const t of document.querySelectorAll('#stats-tabs [role="tab"]')) {
    t.setAttribute('aria-selected', String(t.dataset.tab === statsTab));
  }
  $('stats-variant').hidden = isDaily;
  for (const b of document.querySelectorAll('#stats-variant [data-repeats]')) {
    b.setAttribute('aria-pressed', String((b.dataset.repeats === 'true') === statsRepeats));
  }
  const winRate = s.played ? Math.round((s.wins / s.played) * 100) : 0;
  const cards = [card(s.played, '遊玩次數'), card(winRate, '勝率 %')];
  if (statsTab === 'daily') {
    cards.push(card(displayStreak(s, dailyNumber(new Date())), '目前連勝'), card(s.maxStreak, '最長連勝'));
  } else {
    cards.push(card(s.best ?? '–', '最佳次數'));
  }
  cards.push(card(Number.isFinite(s.bestTime) ? formatDuration(s.bestTime) : '–', '最快'));
  $('stat-cards').innerHTML = cards.join('');

  // highlight the bar of the game that just finished, if it belongs to this tab
  const p = games.practice;
  const shown = isDaily ? games.daily : p.difficulty === statsTab && p.repeats === statsRepeats ? p : null;
  const current = shown?.over ? (shown.won ? shown.guesses.length - 1 : s.dist.length - 1) : -1;
  const peak = Math.max(1, ...s.dist);
  $('dist').innerHTML = s.dist
    .map((n, i) => {
      const label = i === s.dist.length - 1 ? '失敗' : i + 1;
      const width = Math.max(8, Math.round((n / peak) * 100));
      return `<div class="dist-row"><span class="dist-label">${label}</span>` +
        `<span class="dist-bar${i === current ? ' current' : ''}" style="width:${width}%">${n}</span></div>`;
    })
    .join('');

  const foot = $('stats-foot');
  foot.replaceChildren();
  if (statsTab === 'daily' && games.daily.over) foot.append(pill('分享', share, true));
}

// ----- past puzzles -----

function openArchive() {
  renderArchive();
  const dialog = $('archive-dialog');
  if (!dialog.open) dialog.showModal();
}

function puzzleDate(n) {
  const d = new Date(Date.parse(DAILY_EPOCH + 'T00:00:00Z') + (n - 1) * 864e5);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function statusOf(g) {
  if (g.guesses.length === 0) return { text: '未玩', cls: 'todo' };
  if (!g.over) return { text: `進行中 ${g.guesses.length}/${g.maxGuesses}`, cls: 'doing' };
  return g.won ? { text: `✅ ${g.guesses.length} 次`, cls: 'won' } : { text: '❌ 沒猜中', cls: 'lost' };
}

function renderArchive() {
  const today = dailyNumber(new Date());
  const archive = loadArchive();
  const list = $('archive-list');
  list.replaceChildren();
  for (let day = today; day >= 1; day--) {
    const g = day === today ? games.daily : restoreProgress(dailyGame('archive', day), archive[day]);
    const { text, cls } = statusOf(g);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'arch-item' + (game.day === day && game.kind !== 'practice' ? ' current' : '');
    b.innerHTML =
      `<span class="arch-n">#${day}</span>` +
      `<span class="arch-date">${puzzleDate(day)}${day === today ? '・今天' : ''}</span>` +
      `<span class="arch-status ${cls}">${text}</span>`;
    b.addEventListener('click', () => openPuzzle(day));
    list.append(b);
  }
}

function openPuzzle(day) {
  $('archive-dialog').close();
  // save the current game first: a past puzzle is (re)loaded from storage
  pauseClock(game);
  persist(game);
  game = day === dailyNumber(new Date()) ? games.daily : (games.archive = loadArchiveGame(day));
  resumeClockIfStarted(game);
  setMessage('');
  render();
}

function openHelp() {
  const dialog = $('help-dialog');
  if (!dialog.open) dialog.showModal();
}

// ---------- events ----------

// e.code identifies the physical key, so Shift+3 is still "3" (e.key would be
// "#"); fall back to e.key for keyboards or tools that leave code empty.
function digitFromEvent(e) {
  const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
  if (m) return m[1];
  return /^\d$/.test(e.key) ? e.key : null;
}

function onKeyDown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  if (e.target instanceof HTMLTextAreaElement) return;
  const d = digitFromEvent(e);
  if (d !== null) {
    e.preventDefault();
    // typing a guess moves focus off any button clicked earlier, so the
    // Enter that follows submits instead of re-activating that button
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    if (e.shiftKey) toggleMark(d);
    else typeDigit(d);
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    deleteDigit();
  } else if (e.key === 'Enter') {
    // Enter keeps its native meaning on result-banner buttons and on buttons
    // reached by keyboard (focus ring visible); otherwise it submits.
    const t = e.target;
    if (t instanceof HTMLButtonElement && !t.closest('.pad') && (t.closest('.banner') || t.matches(':focus-visible'))) return;
    e.preventDefault();
    submit();
  }
}

// Long-press on touch marks a digit; the click that follows the press is
// swallowed so the digit isn't also typed.
function wireDigitKeys() {
  const digits = $('digits');
  let pressTimer = null;
  let swallowClick = false;
  let lastPointer = 'mouse';
  const cancelPress = () => { clearTimeout(pressTimer); pressTimer = null; };

  digits.addEventListener('pointerdown', (e) => {
    const key = e.target.closest('.key');
    lastPointer = e.pointerType;
    swallowClick = false;
    if (!key || e.pointerType === 'mouse') return;
    pressTimer = setTimeout(() => {
      swallowClick = true;
      toggleMark(key.dataset.digit);
      navigator.vibrate?.(15);
    }, LONG_PRESS_MS);
  });
  for (const type of ['pointerup', 'pointerleave', 'pointercancel']) {
    digits.addEventListener(type, cancelPress);
  }

  digits.addEventListener('click', (e) => {
    const key = e.target.closest('.key');
    if (!key) return;
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    if (markMode) toggleMark(key.dataset.digit);
    else typeDigit(key.dataset.digit);
  });

  // Right-click marks with a mouse; on touch the long-press timer already did.
  digits.addEventListener('contextmenu', (e) => {
    const key = e.target.closest('.key');
    if (!key) return;
    e.preventDefault();
    if (lastPointer === 'mouse') toggleMark(key.dataset.digit);
  });
}

function wireDialogs() {
  for (const dialog of document.querySelectorAll('dialog')) {
    for (const b of dialog.querySelectorAll('.close')) b.addEventListener('click', () => dialog.close());
    // a click on the backdrop lands on the dialog element itself
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  }
  $('stats-btn').addEventListener('click', () => openStats());
  $('help-btn').addEventListener('click', openHelp);
  $('archive-btn').addEventListener('click', openArchive);
  $('today-btn').addEventListener('click', () => openPuzzle(dailyNumber(new Date())));
  $('stats-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { statsTab = t.dataset.tab; renderStats(); }
  });
  $('stats-variant').addEventListener('click', (e) => {
    const b = e.target.closest('[data-repeats]');
    if (b) { statsRepeats = b.dataset.repeats === 'true'; renderStats(); }
  });
}

function wire() {
  buildDigits();
  wireDigitKeys();
  wireDialogs();
  $('mark-btn').addEventListener('click', () => setMarkMode(!markMode));
  $('del-btn').addEventListener('click', deleteDigit);
  $('enter-btn').addEventListener('click', submit);
  for (const b of document.querySelectorAll('.mode')) {
    b.addEventListener('click', () => setMode(b.dataset.mode));
  }
  $('difficulty').addEventListener('click', (e) => {
    const b = e.target.closest('[data-difficulty]');
    if (b) chooseDifficulty(b.dataset.difficulty);
  });
  $('new-game').addEventListener('click', newGame);
  $('repeat-toggle').addEventListener('click', toggleRepeats);
  document.addEventListener('keydown', onKeyDown);
  setInterval(tick, 1000);
  // the clock pauses while the player is away; progress is saved on the way out
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseClock(game);
      persist(game);
    } else if (!game.over) {
      resumeClockIfStarted(game);
    }
    renderTimer();
  });
}

stats = loadStats();
games.daily = loadDaily(dailyNumber(new Date()));
games.practice = newPractice(difficulty, repeats);
game = games.daily;
resumeClockIfStarted(game);

wire();
render();

if (!load(KEYS.seenHelp, false)) {
  openHelp();
  save(KEYS.seenHelp, true);
}
