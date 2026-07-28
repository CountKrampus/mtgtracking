const cron = require('node-cron');
const User = require('../models/User');
const ForumThread = require('../models/ForumThread');
const ForumCategory = require('../models/ForumCategory');
const AnnouncedSet = require('../models/AnnouncedSet');
const { fetchRecentlyReleasedSets } = require('../utils/scryfallSets');

const CATEGORY_SLUG = 'general-discussion';

function buildThreadContent(set) {
  const releaseDate = new Date(set.released_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  const lines = [
    `**${set.name}** (${set.code.toUpperCase()}) has released!`,
    '',
    `- **Release date:** ${releaseDate}`,
    `- **Set type:** ${set.set_type}`,
    `- **Cards:** ${set.card_count}`,
    `- [View on Scryfall](${set.scryfall_uri})`,
    '',
    'What are you excited to pull or brew with from this set?'
  ];
  return lines.join('\n');
}

async function runSetReleaseAnnouncer() {
  let setsChecked = 0;
  let threadsCreated = 0;
  let errors = 0;

  console.log('[setReleaseAnnouncer] Checking Scryfall for newly released sets...');

  let recentSets;
  try {
    recentSets = await fetchRecentlyReleasedSets(7);
  } catch (err) {
    console.error('[setReleaseAnnouncer] Failed to fetch sets from Scryfall:', err.message);
    return { setsChecked: 0, threadsCreated: 0, errors: 1 };
  }

  setsChecked = recentSets.length;
  if (setsChecked === 0) {
    console.log('[setReleaseAnnouncer] No recently released sets found.');
    return { setsChecked, threadsCreated, errors };
  }

  const author = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 }).select('_id');
  if (!author) {
    console.warn('[setReleaseAnnouncer] No admin user found to author announcement threads — skipping.');
    return { setsChecked, threadsCreated: 0, errors: 0 };
  }

  const category = await ForumCategory.findOne({ slug: CATEGORY_SLUG }).select('_id');
  if (!category) {
    console.warn(`[setReleaseAnnouncer] Category "${CATEGORY_SLUG}" not found — skipping.`);
    return { setsChecked, threadsCreated: 0, errors: 0 };
  }

  for (const set of recentSets) {
    try {
      const already = await AnnouncedSet.findOne({ setCode: set.code });
      if (already) continue;

      const thread = await ForumThread.create({
        categoryId: category._id,
        authorId: author._id,
        title: `${set.name} (${set.code.toUpperCase()}) has released!`,
        content: buildThreadContent(set),
        contentFormat: 'markdown',
        tags: [set.code, 'set-release']
      });

      await ForumCategory.findByIdAndUpdate(category._id, {
        $inc: { threadCount: 1 },
        lastActivityAt: new Date()
      });

      await AnnouncedSet.create({
        setCode: set.code,
        setName: set.name,
        releasedAt: set.released_at,
        threadId: thread._id
      });

      threadsCreated++;
    } catch (err) {
      console.error(`[setReleaseAnnouncer] Error announcing set ${set.code}:`, err.message);
      errors++;
    }
  }

  console.log(
    `[setReleaseAnnouncer] Done. Sets checked: ${setsChecked} | Threads created: ${threadsCreated} | Errors: ${errors}`
  );
  return { setsChecked, threadsCreated, errors };
}

function registerSetReleaseAnnouncerJob() {
  // Run at 00:20 daily — offset from the price snapshot (00:05) and
  // weekly health report (00:10) jobs to avoid contention.
  cron.schedule('20 0 * * *', () => {
    runSetReleaseAnnouncer().catch(err =>
      console.error('[setReleaseAnnouncer] Unhandled error:', err.message)
    );
  });
  console.log('[setReleaseAnnouncer] Set release announcer job registered (00:20 daily)');
}

module.exports = { registerSetReleaseAnnouncerJob, runSetReleaseAnnouncer };
