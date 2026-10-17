import { describe, it, expect } from 'vitest';
import { formatDuration } from '../src/time.js';

describe('formatDuration', () => {
  it('shows minutes and zero-padded seconds', () => {
    expect(formatDuration(83000)).toBe('1:23');
    expect(formatDuration(5000)).toBe('0:05');
  });

  it('drops partial seconds', () => {
    expect(formatDuration(59999)).toBe('0:59');
  });

  it('adds hours past an hour', () => {
    expect(formatDuration(3723000)).toBe('1:02:03');
  });
});
