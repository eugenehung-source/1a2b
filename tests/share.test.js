import { describe, it, expect } from 'vitest';
import { shareText } from '../src/share.js';

const URL = 'https://x.github.io/1a2b/';

describe('shareText', () => {
  it('summarises a win without revealing digits', () => {
    expect(shareText(12, [{ a: 1, b: 2 }, { a: 4, b: 0 }], 10, URL)).toBe(
      '1A2B 每日 #12  2/10\n🟢🟡🟡⚪\n🟢🟢🟢🟢\nhttps://x.github.io/1a2b/'
    );
  });

  it('marks a loss with X', () => {
    const results = Array(10).fill({ a: 2, b: 1 });
    const lines = shareText(3, results, 10, URL).split('\n');
    expect(lines[0]).toBe('1A2B 每日 #3  X/10');
    expect(lines).toHaveLength(12);
  });

  it('shows a 0A0B guess as all blanks', () => {
    const lines = shareText(1, [{ a: 0, b: 0 }, { a: 4, b: 0 }], 10, URL).split('\n');
    expect(lines[1]).toBe('⚪⚪⚪⚪');
  });
});

describe('shareText with a time', () => {
  it('adds the solve time to the header', () => {
    const lines = shareText(12, [{ a: 4, b: 0 }], 10, 'https://x.github.io/1a2b/', 83000).split('\n');
    expect(lines[0]).toBe('1A2B 每日 #12  1/10  ⏱1:23');
  });

  it('leaves the header unchanged without a time', () => {
    const lines = shareText(12, [{ a: 4, b: 0 }], 10, 'https://x.github.io/1a2b/').split('\n');
    expect(lines[0]).toBe('1A2B 每日 #12  1/10');
  });
});
