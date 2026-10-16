export function score(secret, guess) {
  let a = 0;
  let b = 0;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) a++;
    else if (secret.includes(guess[i])) b++;
  }
  return { a, b };
}
