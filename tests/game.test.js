import { describe, it, expect } from 'vitest';
import { score } from '../src/game.js';

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
