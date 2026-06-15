const ForumPost = require('../models/ForumPost');
const SpamFilterConfig = require('../models/SpamFilterConfig');

async function checkSpam(authorId, postBody, authorReputation) {
  const config = await SpamFilterConfig.getConfig();
  const reasons = [];

  if (typeof postBody !== 'string' || !postBody.trim()) {
    return { flagged: false, reasons: [] };
  }

  const bodyLower = postBody.toLowerCase();
  const bannedWords = config.bannedWords || [];

  // Check 1: Banned words
  for (const word of bannedWords) {
    if (bodyLower.includes(word.toLowerCase())) {
      reasons.push(`Contains banned word: "${word}"`);
    }
  }

  // Check 2: Reputation threshold
  if (authorReputation < config.minReputationToAutoFlag) {
    reasons.push(`Low reputation: ${authorReputation}`);
  }

  // Check 3: Post rate limiting
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentPostCount = await ForumPost.countDocuments({
    authorId,
    createdAt: { $gte: oneHourAgo }
  });

  if (recentPostCount >= config.maxPostsPerHourPerUser) {
    reasons.push(`Exceeds max posts per hour: ${recentPostCount}/${config.maxPostsPerHourPerUser}`);
  }

  // Determine if flagged based on sensitivity
  let flagged = false;
  if (config.sensitivity === 'strict') {
    flagged = reasons.length > 0;
  } else if (config.sensitivity === 'moderate') {
    flagged = reasons.length >= 2;
  } else if (config.sensitivity === 'lenient') {
    flagged = reasons.length >= 2;
  }

  return { flagged, reasons };
}

module.exports = { checkSpam };
