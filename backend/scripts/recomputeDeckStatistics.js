const mongoose = require('mongoose');
const path = require('path');
const Deck = require('../models/Deck');
const { calculateDeckStatistics } = require('../utils/deckHelpers');

/**
 * Recompute and re-save `statistics` for every deck, fixing decks whose stored
 * totalCards (and manaCurve/colorDistribution, which also read the commander
 * slots) were inflated by the partnerCommander truthiness bug - see the fix in
 * backend/utils/deckHelpers.js. Idempotent - a deck whose recomputed stats
 * already match its stored stats is left untouched (no unnecessary writes).
 * @returns {Promise<{decksChecked: number, decksFixed: number}>}
 */
async function recomputeDeckStatistics() {
  const decks = await Deck.find({});

  let decksChecked = 0;
  let decksFixed = 0;

  for (const deck of decks) {
    try {
      decksChecked++;
      const recomputed = calculateDeckStatistics(deck);
      const before = deck.statistics?.totalCards;

      if (before !== recomputed.totalCards) {
        deck.statistics = recomputed;
        await deck.save();
        decksFixed++;
        console.log(`Fixed "${deck.name}" (${deck._id}): totalCards ${before} -> ${recomputed.totalCards}`);
      }
    } catch (err) {
      console.error(
        `Failed to update deck ${deck._id} (${deck.name}) after ${decksChecked - 1} prior deck(s) succeeded:`,
        err.message
      );
      throw err;
    }
  }

  return { decksChecked, decksFixed };
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const summary = await recomputeDeckStatistics();

  console.log(`Decks checked: ${summary.decksChecked}`);
  console.log(`Decks fixed: ${summary.decksFixed}`);

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Recompute failed:', err);
    process.exit(1);
  });
}

module.exports = { recomputeDeckStatistics };
