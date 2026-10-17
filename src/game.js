// Mastermind-style scoring: a digit counts toward A+B at most as many times
// as it appears in both the secret and the guess.
export function score(secret, guess) {
  let a = 0;
  const left = {};
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) a++;
    left[secret[i]] = (left[secret[i]] ?? 0) + 1;
  }
  let common = 0;
  for (const d of guess) {
    if (left[d] > 0) {
      left[d]--;
      common++;
    }
  }
  return { a, b: common - a };
}

export function validateGuess(guess, length, history) {
  if (guess.length !== length) return { ok: false, reason: 'length' };
  if (history.includes(guess)) return { ok: false, reason: 'repeated' };
  return { ok: true };
}

// Classic rules draw distinct digits; with `repeats` each digit is drawn
// independently, so the same digit may appear more than once.
export function randomSecret(length, rng = Math.random, repeats = false) {
  const pool = [...'0123456789'];
  let secret = '';
  for (let i = 0; i < length; i++) {
    const pick = Math.floor(rng() * pool.length);
    secret += repeats ? pool[pick] : pool.splice(pick, 1)[0];
  }
  return secret;
}

export const DIFFICULTIES = {
  easy: { length: 3, maxGuesses: 8, label: '簡單' },
  normal: { length: 4, maxGuesses: 10, label: '普通' },
  hard: { length: 5, maxGuesses: 12, label: '困難' },
};
