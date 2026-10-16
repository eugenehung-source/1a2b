import { describe, it, expect } from 'vitest';
import { dailyNumber, dailySecret, msUntilNextDay } from '../src/daily.js';

const EPOCH = '2026-10-16';
// Taiwan is UTC+8: Taiwan midnight on day D is 16:00 UTC on day D-1.
const utc = (y, mo, d, h = 0, mi = 0) => new Date(Date.UTC(y, mo - 1, d, h, mi));

describe('dailyNumber', () => {
  it('is 1 at Taiwan midnight on the epoch date', () => {
    expect(dailyNumber(utc(2026, 10, 15, 16, 0), EPOCH)).toBe(1);
  });

  it('rolls over exactly at Taiwan midnight', () => {
    expect(dailyNumber(utc(2026, 10, 16, 15, 59), EPOCH)).toBe(1);
    expect(dailyNumber(utc(2026, 10, 16, 16, 0), EPOCH)).toBe(2);
  });

  it('counts days a month after launch', () => {
    expect(dailyNumber(utc(2026, 11, 15, 4, 0), EPOCH)).toBe(31);
  });
});

describe('dailySecret', () => {
  it('is the same answer every time for a given puzzle number', () => {
    expect(dailySecret(7)).toBe(dailySecret(7));
  });

  it('gives valid, varied 4-digit answers', () => {
    const secrets = Array.from({ length: 60 }, (_, i) => dailySecret(i + 1));
    for (const s of secrets) {
      expect(s).toMatch(/^\d{4}$/);
      expect(new Set(s).size).toBe(4);
    }
    expect(new Set(secrets).size).toBeGreaterThanOrEqual(50);
  });
});

describe('msUntilNextDay', () => {
  it('counts down to the next Taiwan midnight', () => {
    expect(msUntilNextDay(utc(2026, 10, 16, 15, 59))).toBe(60000);
  });

  it('is a full day right at Taiwan midnight', () => {
    expect(msUntilNextDay(utc(2026, 10, 16, 16, 0))).toBe(864e5);
  });
});
