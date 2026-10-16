import { randomSecret } from './game.js';

export const DAILY_EPOCH = '2026-10-16';

const DAY_MS = 864e5;
const TAIWAN_OFFSET_MS = 8 * 3600e3;

export function dailyNumber(date, epoch = DAILY_EPOCH) {
  const taiwanDay = Math.floor((date.getTime() + TAIWAN_OFFSET_MS) / DAY_MS);
  const epochDay = Date.parse(epoch + 'T00:00:00Z') / DAY_MS;
  return taiwanDay - epochDay + 1;
}

export const DAILY_LENGTH = 4;
export const DAILY_MAX = 10;

// Seeded PRNG. Do not change after launch: it would change past and current answers.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailySecret(n) {
  return randomSecret(DAILY_LENGTH, mulberry32(Math.imul(n, 2654435761) >>> 0));
}

export function msUntilNextDay(date) {
  const elapsed = (date.getTime() + TAIWAN_OFFSET_MS) % DAY_MS;
  return DAY_MS - elapsed;
}
