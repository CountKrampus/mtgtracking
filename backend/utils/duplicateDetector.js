const ForumThread = require('../models/ForumThread');

function normalizeText(text) {
  // Convert to lowercase, remove special chars, split into words
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2); // Ignore short words
}

function jaccardSimilarity(set1, set2) {
  // Similarity = intersection / union
  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

async function findDuplicateThreads(newThreadTitle, categoryId, threshold = 0.6) {
  // 1. Normalize new thread title into word set
  const newWords = new Set(normalizeText(newThreadTitle));

  // 2. Fetch all threads in category
  const threads = await ForumThread.find({ categoryId }).select('_id title').lean();

  // 3. Compare each thread to new thread
  const candidates = [];
  for (const thread of threads) {
    const threadWords = new Set(normalizeText(thread.title));
    const similarity = jaccardSimilarity(newWords, threadWords);

    if (similarity >= threshold) {
      candidates.push({
        threadId: thread._id,
        title: thread.title,
        similarity: parseFloat(similarity.toFixed(2))
      });
    }
  }

  // Sort by similarity descending
  return candidates.sort((a, b) => b.similarity - a.similarity);
}

module.exports = { normalizeText, jaccardSimilarity, findDuplicateThreads };
