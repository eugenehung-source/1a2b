// localStorage can throw (private mode, blocked storage) or hold corrupted
// data; both fall back silently so the game stays playable.

function sameKind(value, fallback) {
  if (fallback === null || fallback === undefined) return true;
  if (Array.isArray(fallback)) return Array.isArray(value);
  if (typeof fallback === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  return typeof value === typeof fallback;
}

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return sameKind(value, fallback) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: keep playing without persistence
  }
}
