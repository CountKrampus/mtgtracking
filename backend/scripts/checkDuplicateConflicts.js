// Read-only: reports card rows that would violate the unique
// duplicate-prevention index. Run from backend/: node scripts/checkDuplicateConflicts.js
require('dotenv').config();
const mongoose = require('mongoose');
const Card = require('../models/Card');
const { findDuplicateGroups } = require('../utils/cardUtils');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const users = await Card.distinct('userId');
  let totalGroups = 0;

  for (const userId of users) {
    const cards = await Card.find({ userId }).lean();
    const { exactGroups } = findDuplicateGroups(cards);
    for (const group of exactGroups) {
      totalGroups++;
      const c = group.cards[0];
      console.log(`user=${userId} name="${c.name}" set="${c.set}" condition=${c.condition} foil=${c.isFoil} rows=${group.cards.length}`);
    }
  }

  console.log(totalGroups === 0
    ? 'No conflicts - the unique index can build.'
    : `${totalGroups} conflicting group(s) - run the Find Duplicates tool, then restart the backend.`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
