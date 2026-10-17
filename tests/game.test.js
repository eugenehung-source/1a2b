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

  it('counts each repeated digit only as often as the answer has it', () => {
    expect(score('1123', '1111')).toEqual({ a: 2, b: 0 });
    expect(score('1234', '1111')).toEqual({ a: 1, b: 0 });
  });

  it('matches repeated digits across positions', () => {
    expect(score('1122', '2211')).toEqual({ a: 0, b: 4 });
    expect(score('1123', '3111')).toEqual({ a: 1, b: 2 });
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

  it('accepts a guess with repeated digits', () => {
    expect(validateGuess('1123', 4, [])).toEqual({ ok: true });
    expect(validateGuess('0000', 4, [])).toEqual({ ok: true });
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

  it('by default draws distinct digits (classic rules)', () => {
    expect(randomSecret(4, seq(0, 0, 0, 0))).toBe('0123');
  });

  it('by default never repeats a digit', () => {
    for (let i = 0; i < 1000; i++) {
      const s = randomSecret(5);
      expect(s).toMatch(/^\d{5}$/);
      expect(new Set(s).size).toBe(5);
    }
  });

  it('with repeats allowed, picks each digit independently', () => {
    expect(randomSecret(4, seq(0, 0, 0, 0), true)).toBe('0000');
    expect(randomSecret(3, seq(0.15, 0.15, 0.95), true)).toBe('119');
  });

  it('with repeats allowed, yields some secrets with repeated digits', () => {
    const secrets = Array.from({ length: 1000 }, () => randomSecret(5, Math.random, true));
    for (const s of secrets) expect(s).toMatch(/^\d{5}$/);
    expect(secrets.some((s) => new Set(s).size < 5)).toBe(true);
  });
});
