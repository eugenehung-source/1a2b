import { describe, it, expect } from 'vitest';
import { score, validateGuess, randomSecret } from '../src/game.js';

describe('score', () => {
  it('counts exact and misplaced digits', () => {
    expect(score('1234', '1325')).toEqual({ a: 1, b: 2 });
  });

  it('all correct', () => expect(score('0371', '0371')).toEqual({ a: 4, b: 0 }));
  it('nothing matches', () => expect(score('1234', '5678')).toEqual({ a: 0, b: 0 }));
  it('leading zero counts as a digit', () => expect(score('0123', '3210')).toEqual({ a: 0, b: 4 }));
  it('works for 3 and 5 digits', () => {
    expect(score('012', '021')).toEqual({ a: 1, b: 2 });
    expect(score('01234', '43210')).toEqual({ a: 1, b: 4 });
  });
});

describe('validateGuess', () => {
  it('accepts a well-formed new guess', () => {
    expect(validateGuess('1234', 4, [])).toEqual({ ok: true });
  });

  it('rejects a guess of the wrong length', () => {
    expect(validateGuess('123', 4, [])).toEqual({ ok: false, reason: 'length' });
    expect(validateGuess('12345', 4, [])).toEqual({ ok: false, reason: 'length' });
  });

  it('rejects a guess with a repeated digit', () => {
    expect(validateGuess('1123', 4, [])).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('rejects a guess already made', () => {
    expect(validateGuess('1234', 4, ['5678', '1234'])).toEqual({ ok: false, reason: 'repeated' });
  });

  it('reports length before any other problem', () => {
    expect(validateGuess('11', 4, ['11'])).toEqual({ ok: false, reason: 'length' });
  });
});

describe('randomSecret', () => {
  const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };

  it('builds a secret from injected rng', () => {
    expect(randomSecret(4, seq(0, 0, 0, 0))).toBe('0123');
  });

  it('always yields distinct digits of the requested length', () => {
    for (let i = 0; i < 1000; i++) {
      const s = randomSecret(5);
      expect(s).toMatch(/^\d{5}$/);
      expect(new Set(s).size).toBe(5);
    }
  });
});
