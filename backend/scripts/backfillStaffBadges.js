const mongoose = require('mongoose');
const path = require('path');
const User = require('../models/User');
const Badge = require('../models/Badge');
const { STAFF_ROLES, STAFF_ROLE_BADGES } = require('../utils/permissions');

/**
 * Ensure a Badge document exists for every entry in STAFF_ROLE_BADGES.
 * Upserts by name so re-running is idempotent (existing docs are untouched).
 */
async function ensureStaffBadgesExist() {
  for (const badge of Object.values(STAFF_ROLE_BADGES)) {
    await Badge.findOneAndUpdate(
      { name: badge.name },
      { $setOnInsert: { name: badge.name, description: badge.description, icon: badge.icon } },
      { upsert: true }
    );
  }
}

/**
 * Grant the correct staff badge to every user currently holding a staff role,
 * and fix the legacy "Owner" badge name to "Site Owner" on existing admins
 * (dropping the legacy entry instead of duplicating if "Site Owner" is
 * already present). Idempotent — safe to run more than once.
 * @returns {Promise<{usersChecked: number, badgesGranted: number, namesFixed: number}>}
 */
async function backfillStaffBadges() {
  await ensureStaffBadgesExist();

  const staffUsers = await User.find({ role: { $in: STAFF_ROLES } });

  let usersChecked = 0;
  let badgesGranted = 0;
  let namesFixed = 0;

  for (const user of staffUsers) {
    usersChecked++;
    let changed = false;

    const legacyIndex = user.badges.findIndex(b => b.name === 'Owner');
    if (legacyIndex !== -1) {
      const alreadyHasSiteOwner = user.badges.some(b => b.name === 'Site Owner');
      if (alreadyHasSiteOwner) {
        user.badges.splice(legacyIndex, 1);
      } else {
        user.badges[legacyIndex].name = 'Site Owner';
      }
      namesFixed++;
      changed = true;
    }

    const badge = STAFF_ROLE_BADGES[user.role];
    if (badge && !user.badges.some(b => b.name === badge.name)) {
      user.badges.push({
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        earnedAt: new Date()
      });
      badgesGranted++;
      changed = true;
    }

    if (changed) {
      await user.save();
    }
  }

  return { usersChecked, badgesGranted, namesFixed };
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const summary = await backfillStaffBadges();

  console.log(`Users checked: ${summary.usersChecked}`);
  console.log(`Badges granted: ${summary.badgesGranted}`);
  console.log(`Names fixed (Owner -> Site Owner): ${summary.namesFixed}`);

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
}

module.exports = { backfillStaffBadges, ensureStaffBadgesExist };
