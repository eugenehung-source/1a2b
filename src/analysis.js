import { score } from './game.js';

// Post-game analysis: how many answers were still possible after each guess.

// Every answer allowed by the rules: distinct digits, or any digit string.
function allAnswers(length, repeats) {
  const out = [];
  const grow = (prefix) => {
    if (prefix.length === length) {
      out.push(prefix);
      return;
    }
    for (const d of '0123456789') {
      if (repeats || !prefix.includes(d)) grow(prefix + d);
    }
  };
  grow('');
  return out;
}

export function totalCandidates(length, repeats) {
  return allAnswers(length, repeats).length;
}

// counts[i] = answers matching the feedback of guesses 0..i
export function remainingCounts(guesses, results, length, repeats) {
  let candidates = allAnswers(length, repeats);
  return guesses.map((guess, i) => {
    const { a, b } = results[i];
    candidates = candidates.filter((c) => {
      const r = score(c, guess);
      return r.a === a && r.b === b;
    });
    return candidates.length;
  });
}
