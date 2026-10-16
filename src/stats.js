export function emptyStats(maxGuesses) {
  return {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastWinDay: null,
    best: null,
    dist: Array(maxGuesses + 1).fill(0),
  };
}

export function recordResult(stats, { won, guesses, dayNumber }) {
  const dist = [...stats.dist];
  dist[won ? guesses - 1 : dist.length - 1]++;
  const next = {
    ...stats,
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    best: won && (stats.best === null || guesses < stats.best) ? guesses : stats.best,
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
