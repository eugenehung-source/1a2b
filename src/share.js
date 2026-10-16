import { DAILY_LENGTH } from './daily.js';

function row({ a, b }) {
  return '🟢'.repeat(a) + '🟡'.repeat(b) + '⚪'.repeat(DAILY_LENGTH - a - b);
}

export function shareText(dayNumber, results, maxGuesses, url) {
  const won = results.at(-1)?.a === DAILY_LENGTH;
  const header = `1A2B 每日 #${dayNumber}  ${won ? results.length : 'X'}/${maxGuesses}`;
  return [header, ...results.map(row), url].join('\n');
}
