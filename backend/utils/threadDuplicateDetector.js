const ForumThread = require('../models/ForumThread');

function calculateSimilarity(title1, title2) {
  const getKeywords = (text) => {
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2);
  };

  const keywords1 = new Set(getKeywords(title1));
  const keywords2 = new Set(getKeywords(title2));

  if (keywords1.size === 0 && keywords2.size === 0) return 1;
  if (keywords1.size === 0 || keywords2.size === 0) return 0;

  const intersection = new Set([...keywords1].filter(k => keywords2.has(k)));
  const union = new Set([...keywords1, ...keywords2]);

  return intersection.size / union.size;
}

async function findDuplicateThreads(title, categoryId, limit = 5) {
  const allThreads = await ForumThread.find({ categoryId })
    .select('title _id')
    .lean();

  const scored = allThreads.map(thread => ({
    ...thread,
    similarity: calculateSimilarity(title, thread.title)
  }))
    .filter(t => t.similarity >= 0.4)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return scored.map(result => ({
    ...result,
    label: result.similarity >= 0.9
      ? 'exact'
      : result.similarity >= 0.6
        ? 'high'
        : result.similarity >= 0.4
          ? 'medium'
          : 'low'
  }));
}

module.exports = { findDuplicateThreads };
