const NodeCache = require('node-cache');

// useClones: false avoids deep-copy overhead — callers must not mutate returned values
const cache = new NodeCache({ useClones: false });

module.exports = {
  get: (key) => cache.get(key),
  set: (key, value, ttlSeconds) => cache.set(key, value, ttlSeconds),
  del: (key) => cache.del(key),
  delPattern: (prefix) => {
    const keys = cache.keys().filter(k => k.startsWith(prefix));
    if (keys.length > 0) cache.del(keys);
  },
};
