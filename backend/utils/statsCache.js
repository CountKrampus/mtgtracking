// In-memory cache for cards and stats - relocated verbatim from server.js.
// Per-process, non-persistent: acceptable since it's a 5-minute TTL read-through
// cache, not a source of truth, and the app runs as a single backend process.
const cache = {
  cards: new Map(),
  stats: new Map(),
  ttl: 5 * 60 * 1000 // 5 minute TTL
};

function getFromCache(key, userId) {
  const entry = cache[key]?.get(userId?.toString());
  if (!entry) return null;
  if (Date.now() - entry.timestamp > cache.ttl) {
    cache[key].delete(userId?.toString());
    return null;
  }
  return entry.data;
}

function setInCache(key, userId, data) {
  if (!cache[key]) cache[key] = new Map();
  cache[key].set(userId?.toString(), { data, timestamp: Date.now() });
}

function clearCache(userId) {
  cache.cards.delete(userId?.toString());
  cache.stats.delete(userId?.toString());
}

module.exports = { getFromCache, setInCache, clearCache };
