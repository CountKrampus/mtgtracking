const mongoose = require('mongoose');

// API Response Cache Schema (24-hour TTL)
const apiCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete after 24 hours
});

const ApiCache = mongoose.models.ApiCache || mongoose.model('ApiCache', apiCacheSchema);

// Cached API call helper
async function cachedApiCall(key, fetchFn) {
  try {
    const cached = await ApiCache.findOne({ key });
    if (cached) return cached.data;
  } catch {
    // Cache miss or error, proceed to fetch
  }

  const data = await fetchFn();

  try {
    await ApiCache.findOneAndUpdate(
      { key },
      { key, data, createdAt: new Date() },
      { upsert: true, new: true }
    );
  } catch {
    // Cache write failure is non-critical
  }

  return data;
}

module.exports = { ApiCache, cachedApiCall };
