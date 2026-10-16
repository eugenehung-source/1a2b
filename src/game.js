export function score(secret, guess) {
  let a = 0;
  let b = 0;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) a++;
    else if (secret.includes(guess[i])) b++;
  }
  return { a, b };
}

export function validateGuess(guess, length, history) {
  if (guess.length !== length) return { ok: false, reason: 'length' };
  if (new Set(guess).size !== guess.length) return { ok: false, reason: 'duplicate' };
  if (history.includes(guess)) return { ok: false, reason: 'repeated' };
  return { ok: true };
}

export function randomSecret(length, rng = Math.random) {
  const pool = [...'0123456789'];
  let secret = '';
  for (let i = 0; i < length; i++) {
    secret += pool.splice(Math.floor(rng() * pool.length), 1)[0];
  }
  return secret;
}

export const DIFFICULTIES = {
  easy: { length: 3, maxGuesses: 8, label: '簡單' },
  normal: { length: 4, maxGuesses: 10, label: '普通' },
  hard: { length: 5, maxGuesses: 12, label: '困難' },
};
