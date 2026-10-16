import { DIFFICULTIES, score, validateGuess, randomSecret } from './game.js';
import { emptyStats, recordResult } from './stats.js';
import { load, save } from './storage.js';

const KEYS = {
  stats: '1a2b:v1:stats',
  difficulty: '1a2b:v1:difficulty',
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

let stats = loadStats();
let game = newPractice(difficulty);

function validStats(s, maxGuesses) {
  return (
    s && typeof s === 'object' &&
    typeof s.played === 'number' && typeof s.wins === 'number' &&
    Array.isArray(s.dist) && s.dist.length === maxGuesses + 1
  );
}

function loadStats() {
  const raw = load(KEYS.stats, {});
  const out = {};
  for (const [kind, cfg] of Object.entries(DIFFICULTIES)) {
    out[kind] = validStats(raw[kind], cfg.maxGuesses) ? raw[kind] : emptyStats(cfg.maxGuesses);
  }
  return out;
}

function newPractice(diff) {
  const { length, maxGuesses } = DIFFICULTIES[diff];
  return {
    kind: 'practice',
    difficulty: diff,
    length,
    maxGuesses,
    secret: randomSecret(length),
    guesses: [],
    results: [],
    input: '',
    over: false,
    won: false,
  };
}

const inProgress = (g) => g.guesses.length > 0 && !g.over;

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
  const result = score(game.secret, game.input);
  game.guesses.push(game.input);
  game.results.push(result);
  game.input = '';
  if (result.a === game.length) finish(true);
  else if (game.guesses.length >= game.maxGuesses) finish(false);
  setMessage(`第 ${game.guesses.length} 次：${result.a}A${result.b}B`);
  render();
}

function finish(won) {
  game.over = true;
  game.won = won;
  stats[game.difficulty] = recordResult(stats[game.difficulty], { won, guesses: game.guesses.length });
  save(KEYS.stats, stats);
}

function chooseDifficulty(diff) {
  if (diff === game.difficulty && !game.over) return;
  if (inProgress(game) && !confirm('放棄目前這局？')) return;
  difficulty = diff;
  save(KEYS.difficulty, difficulty);
  game = newPractice(difficulty);
  setMessage('');
  render();
}

function newGame() {
  if (inProgress(game) && !confirm('放棄目前這局？')) return;
  game = newPractice(game.difficulty);
  setMessage('');
  render();
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

function renderHistory() {
  const list = $('history');
  const rendered = list.children.length;
  if (rendered > game.guesses.length) list.replaceChildren();
  for (let i = list.children.length; i < game.guesses.length; i++) {
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

function renderBanner() {
  const banner = $('banner');
  banner.hidden = !game.over;
  if (!game.over) return;
  $('banner-text').textContent = game.won
    ? `🎉 第 ${game.guesses.length} 次猜中！`
    : `答案是 ${game.secret}`;
  const actions = $('banner-actions');
  actions.replaceChildren();
  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'pill primary';
  again.textContent = '再來一局';
  again.addEventListener('click', newGame);
  actions.append(again);
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
  $('difficulty').addEventListener('click', (e) => {
    const b = e.target.closest('[data-difficulty]');
    if (b) chooseDifficulty(b.dataset.difficulty);
  });
  $('new-game').addEventListener('click', newGame);
  document.addEventListener('keydown', onKeyDown);
}

wire();
render();
