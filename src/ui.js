import { DIFFICULTIES, score, validateGuess, randomSecret } from './game.js';
import { dailyNumber, dailySecret, msUntilNextDay, DAILY_LENGTH, DAILY_MAX } from './daily.js';
import { emptyStats, recordResult } from './stats.js';
import { shareText } from './share.js';
import { load, save } from './storage.js';

const KEYS = {
  stats: '1a2b:v1:stats',
  difficulty: '1a2b:v1:difficulty',
  daily: '1a2b:v1:daily',
};

const ERRORS = {
  length: (n) => `請輸入 ${n} 位數字`,
  duplicate: () => '數字不能重複',
  repeated: () => '這組已經猜過了',
};

const $ = (id) => document.getElementById(id);

// ---------- state ----------

let difficulty = load(KEYS.difficulty, 'normal');
if (!DIFFICULTIES[difficulty]) difficulty = 'normal';

// Initialised at the bottom of the file, once every helper is defined.
let stats;
const games = { daily: null, practice: null };
let game;

function validStats(s, maxGuesses) {
  return (
    s && typeof s === 'object' &&
    typeof s.played === 'number' && typeof s.wins === 'number' &&
    Array.isArray(s.dist) && s.dist.length === maxGuesses + 1
  );
}

function loadStats() {
  const raw = load(KEYS.stats, {});
  const limits = { daily: DAILY_MAX, ...Object.fromEntries(Object.entries(DIFFICULTIES).map(([k, v]) => [k, v.maxGuesses])) };
  const out = {};
  for (const [kind, maxGuesses] of Object.entries(limits)) {
    out[kind] = validStats(raw[kind], maxGuesses) ? raw[kind] : emptyStats(maxGuesses);
  }
  return out;
}

const freshMarks = () => Array(10).fill('unknown');

function blankGame(fields) {
  return { guesses: [], results: [], marks: freshMarks(), input: '', over: false, won: false, ...fields };
}

function newPractice(diff) {
  const { length, maxGuesses } = DIFFICULTIES[diff];
  return blankGame({ kind: 'practice', difficulty: diff, length, maxGuesses, secret: randomSecret(length) });
}

// A saved daily game from another day is dropped unrecorded: the streak
// breaks on its own because that day has no win.
function loadDaily(day) {
  const g = blankGame({
    kind: 'daily', day, length: DAILY_LENGTH, maxGuesses: DAILY_MAX, secret: dailySecret(day), recorded: false,
  });
  const saved = load(KEYS.daily, {});
  if (saved.day !== day || !Array.isArray(saved.guesses)) return g;
  for (const guess of saved.guesses.slice(0, DAILY_MAX)) {
    if (g.over || !validateGuess(guess, DAILY_LENGTH, g.guesses).ok) break;
    applyGuess(g, guess);
  }
  if (Array.isArray(saved.marks) && saved.marks.length === 10) g.marks = saved.marks;
  g.recorded = saved.recorded === true;
  if (g.over && !g.recorded) recordFinish(g);
  return g;
}

function saveDaily(g) {
  save(KEYS.daily, { day: g.day, guesses: g.guesses, marks: g.marks, recorded: g.recorded });
}

const inProgress = (g) => g.guesses.length > 0 && !g.over;

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
  const result = { won: g.won, guesses: g.guesses.length };
  if (g.kind === 'daily') {
    if (g.recorded) return;
    stats.daily = recordResult(stats.daily, { ...result, dayNumber: g.day });
    g.recorded = true;
    saveDaily(g);
  } else {
    stats[g.difficulty] = recordResult(stats[g.difficulty], result);
  }
  save(KEYS.stats, stats);
}

// ---------- actions ----------

function typeDigit(d) {
  if (game.over) return;
  if (game.input.includes(d)) {
    shake(keyEl(d));
    return;
  }
  if (game.input.length >= game.length) return;
  game.input += d;
  setMessage('');
  render();
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
  if (game.kind === 'daily') saveDaily(game);
  if (game.over) recordFinish(game);
  setMessage(`第 ${game.guesses.length} 次：${result.a}A${result.b}B`);
  render();
}

function setMode(mode) {
  if (game === games[mode]) return;
  game = games[mode];
  setMessage('');
  render();
}

function chooseDifficulty(diff) {
  if (diff === game.difficulty && !game.over) return;
  if (inProgress(game) && !confirm('放棄目前這局？')) return;
  difficulty = diff;
  save(KEYS.difficulty, difficulty);
  game = games.practice = newPractice(difficulty);
  setMessage('');
  render();
}

function newGame() {
  if (inProgress(game) && !confirm('放棄目前這局？')) return;
  game = games.practice = newPractice(game.difficulty);
  setMessage('');
  render();
}

function share() {
  const g = games.daily;
  const url = location.origin + location.pathname;
  const text = shareText(g.day, g.results, g.maxGuesses, url);
  const fallback = () => showShareFallback(text);
  if (!navigator.clipboard?.writeText) return fallback();
  navigator.clipboard.writeText(text).then(
    () => setMessage('已複製戰績，貼給朋友吧！'),
    fallback,
  );
}

function showShareFallback(text) {
  let box = $('share-fallback');
  if (!box) {
    box = document.createElement('textarea');
    box.id = 'share-fallback';
    box.className = 'share-fallback';
    box.readOnly = true;
    box.setAttribute('aria-label', '分享文字');
    $('banner').append(box);
  }
  box.value = text;
  box.rows = text.split('\n').length;
  box.focus();
  box.select();
  setMessage('無法自動複製，請手動複製上面的文字');
}

// Called every second: keeps the countdown fresh and swaps in the new daily
// puzzle once the finished one is from a past day. An unfinished daily game
// keeps going until reload.
function tick() {
  const today = dailyNumber(new Date());
  const daily = games.daily;
  if (daily.over && daily.day !== today) {
    const wasShowing = game === daily;
    games.daily = loadDaily(today);
    if (wasShowing) {
      game = games.daily;
      setMessage('新的一題來了！');
    }
    render();
    return;
  }
  const el = $('countdown');
  if (el) el.textContent = formatCountdown(msUntilNextDay(new Date()));
}

function formatCountdown(ms) {
  const s = Math.floor(ms / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// ---------- rendering ----------

const keyEl = (d) => document.querySelector(`.key[data-digit="${d}"]`);

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
    li.className = 'row' + (a === game.length ? ' win' : '');
    li.innerHTML = `
      <span class="row-n">${i + 1}.</span>
      <span class="row-digits">${game.guesses[i]}</span>
      <span class="row-result" aria-label="${a}A${b}B">
        <span class="tag tag-a">${a}A</span><span class="tag tag-b">${b}B</span>
      </span>`;
    list.append(li);
  }
  $('empty-hint').hidden = game.guesses.length > 0;
  if (list.children.length > rendered) list.lastElementChild.scrollIntoView({ block: 'nearest' });
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
  $('banner-text').textContent = game.won
    ? `🎉 第 ${game.guesses.length} 次猜中！`
    : `答案是 ${game.secret}`;
  const actions = $('banner-actions');
  actions.replaceChildren();
  if (game.kind === 'daily') {
    actions.append(pill('分享', share, true));
    const next = document.createElement('span');
    next.className = 'next';
    next.innerHTML = '下一題 <span id="countdown"></span>';
    actions.append(next);
    $('countdown').textContent = formatCountdown(msUntilNextDay(new Date()));
  } else {
    actions.append(pill('再來一局', newGame, true));
  }
}

function renderPad() {
  for (const key of document.querySelectorAll('.key')) {
    key.classList.toggle('used', game.input.includes(key.dataset.digit));
    key.disabled = game.over;
  }
  $('del-btn').disabled = game.over;
  $('enter-btn').disabled = game.over;
}

function renderBars() {
  for (const b of document.querySelectorAll('.mode')) {
    b.setAttribute('aria-pressed', String(b.dataset.mode === game.kind));
  }
  $('difficulty').hidden = game.kind !== 'practice';
  $('daily-label').hidden = game.kind !== 'daily';
  if (game.kind === 'daily') $('daily-label').textContent = `每日挑戰 #${game.day}`;
  for (const b of document.querySelectorAll('[data-difficulty]')) {
    b.setAttribute('aria-pressed', String(b.dataset.difficulty === game.difficulty));
  }
}

function render() {
  renderBars();
  renderHistory();
  renderEntry();
  renderBanner();
  renderPad();
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
  if (d !== null && !e.shiftKey) {
    e.preventDefault();
    typeDigit(d);
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    deleteDigit();
  } else if (e.key === 'Enter') {
    // let Enter activate a focused button other than the pad
    if (e.target instanceof HTMLButtonElement && !e.target.closest('.pad')) return;
    e.preventDefault();
    submit();
  }
}

function wire() {
  buildDigits();
  $('digits').addEventListener('click', (e) => {
    const key = e.target.closest('.key');
    if (key) typeDigit(key.dataset.digit);
  });
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
  document.addEventListener('keydown', onKeyDown);
  setInterval(tick, 1000);
}

stats = loadStats();
games.daily = loadDaily(dailyNumber(new Date()));
games.practice = newPractice(difficulty);
game = games.daily;

wire();
render();
