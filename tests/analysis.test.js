import { describe, it, expect } from 'vitest';
import { totalCandidates, remainingCounts } from '../src/analysis.js';

describe('totalCandidates', () => {
  it('counts distinct-digit answers for classic rules', () => {
    expect(totalCandidates(4, false)).toBe(5040);
    expect(totalCandidates(3, false)).toBe(720);
  });

  it('counts every digit string when repeats are allowed', () => {
    expect(totalCandidates(4, true)).toBe(10000);
  });
});

describe('remainingCounts', () => {
  it('counts answers still consistent after each guess', () => {
    expect(remainingCounts(['1234'], [{ a: 0, b: 0 }], 4, false)).toEqual([360]);
  });

  it('applies the rules of the variant being played', () => {
    expect(remainingCounts(['1111'], [{ a: 1, b: 0 }], 4, false)).toEqual([2016]);
    expect(remainingCounts(['1111'], [{ a: 1, b: 0 }], 4, true)).toEqual([2916]);
  });

  it('narrows step by step down to the single answer', () => {
    const counts = remainingCounts(['1234', '5678', '0956'], [{ a: 0, b: 0 }, { a: 0, b: 2 }, { a: 4, b: 0 }], 4, false);
    expect(counts[0]).toBe(360);
    expect(counts[1]).toBeLessThan(360);
    expect(counts[2]).toBe(1);
  });
});
