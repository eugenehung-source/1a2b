export function emptyStats(maxGuesses) {
  return {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastWinDay: null,
    best: null,
    bestTime: null,
    dist: Array(maxGuesses + 1).fill(0),
  };
}

export function recordResult(stats, { won, guesses, dayNumber, timeMs }) {
  const dist = [...stats.dist];
  dist[won ? guesses - 1 : dist.length - 1]++;
  const prevTime = stats.bestTime ?? null; // absent in stats saved before timing existed
  const next = {
    ...stats,
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    best: won && (stats.best === null || guesses < stats.best) ? guesses : stats.best,
    bestTime: won && typeof timeMs === 'number' && (prevTime === null || timeMs < prevTime) ? timeMs : prevTime,
    dist,
  };
  if (dayNumber !== undefined && won) {
    next.currentStreak = stats.lastWinDay === dayNumber - 1 ? stats.currentStreak + 1 : 1;
    next.maxStreak = Math.max(stats.maxStreak, next.currentStreak);
    next.lastWinDay = dayNumber;
  } else if (dayNumber !== undefined) {
    next.currentStreak = 0;
  }
  return next;
}

// recordResult only runs on days that were played, so a missed day must be
// detected at display time.
export function displayStreak(stats, todayNumber) {
  return stats.lastWinDay !== null && stats.lastWinDay >= todayNumber - 1 ? stats.currentStreak : 0;
}
