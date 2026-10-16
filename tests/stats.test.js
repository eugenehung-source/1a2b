import { describe, it, expect } from 'vitest';
import { emptyStats, recordResult, displayStreak } from '../src/stats.js';

describe('recordResult', () => {
  it('records a win in the guess-count distribution', () => {
    const s = recordResult(emptyStats(10), { won: true, guesses: 3 });
    expect(s.played).toBe(1);
    expect(s.wins).toBe(1);
    expect(s.dist[2]).toBe(1);
    expect(s.best).toBe(3);
  });

  it('records a loss in the last distribution slot', () => {
    const s = recordResult(emptyStats(10), { won: false, guesses: 10 });
    expect(s.played).toBe(1);
    expect(s.wins).toBe(0);
    expect(s.dist[10]).toBe(1);
    expect(s.dist[9]).toBe(0);
    expect(s.best).toBe(null);
  });

  it('does not modify the stats it is given', () => {
    const before = emptyStats(10);
    Object.freeze(before);
    Object.freeze(before.dist);
    const after = recordResult(before, { won: true, guesses: 4 });
    expect(after).not.toBe(before);
    expect(before.played).toBe(0);
  });

  it('keeps the fewest guesses as best', () => {
    let s = emptyStats(10);
    s = recordResult(s, { won: true, guesses: 5 });
    s = recordResult(s, { won: true, guesses: 3 });
    expect(s.best).toBe(3);
    s = recordResult(s, { won: true, guesses: 7 });
    expect(s.best).toBe(3);
  });
});

describe('daily streaks', () => {
  const play = (results) =>
    results.reduce((s, [dayNumber, won]) => recordResult(s, { won, guesses: 5, dayNumber }), emptyStats(10));

  it('grows with wins on consecutive days', () => {
    const s = play([[1, true], [2, true]]);
    expect(s.currentStreak).toBe(2);
    expect(s.maxStreak).toBe(2);
    expect(s.lastWinDay).toBe(2);
  });

  it('restarts after a skipped day', () => {
    const s = play([[1, true], [3, true]]);
    expect(s.currentStreak).toBe(1);
    expect(s.maxStreak).toBe(1);
  });

  it('resets on a loss but keeps the record', () => {
    const s = play([[1, true], [2, true], [3, false]]);
    expect(s.currentStreak).toBe(0);
    expect(s.maxStreak).toBe(2);
  });

  it('ignores streaks for practice games', () => {
    const daily = play([[1, true]]);
    const s = recordResult(daily, { won: false, guesses: 10 });
    expect(s.currentStreak).toBe(1);
    expect(s.lastWinDay).toBe(1);
  });
});

describe('displayStreak', () => {
  const s = { ...emptyStats(10), currentStreak: 3, maxStreak: 3, lastWinDay: 4 };

  it('shows the streak on the day it was extended', () => {
    expect(displayStreak(s, 4)).toBe(3);
  });

  it('still shows it the next day before playing', () => {
    expect(displayStreak(s, 5)).toBe(3);
  });

  it('drops to zero once a day has been missed', () => {
    expect(displayStreak(s, 6)).toBe(0);
  });
});
