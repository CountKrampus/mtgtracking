const User = require('../models/User');
const Referral = require('../models/Referral');
const SystemSettings = require('../models/SystemSettings');

/**
 * Referral reward payouts.
 *
 * Every award is IDEMPOTENT. A stage is only paid if its flag
 * (`signupRepAwarded` / `qualificationRepAwarded`) is still false, and the
 * flag is flipped in the SAME conditional update that claims the stage. That
 * means concurrent calls, retries, re-logins, and re-fires from the card-add
 * hook can never double-pay a stage — even if two requests race, only one
 * `findOneAndUpdate` matches `{ flag: false }` and wins.
 *
 * Reputation is used as the reward currency because it's already integrated
 * into the leaderboard, upvotes, and feature gating (e.g. price-flagging at
 * 50 rep) — no parallel economy to balance.
 */

const REFERRAL_BADGES = {
  connector: {
    name: 'Connector',
    description: 'Invited your first friend to MTG Tracker',
    icon: 'lucide:UserPlus'
  },
  evangelist: {
    name: 'Evangelist',
    description: 'Invited 5 friends to MTG Tracker',
    icon: 'lucide:Megaphone'
  }
};

async function getReferralSettings() {
  return {
    enabled: await SystemSettings.getValue('referralsEnabled', true),
    signupRep: Number(await SystemSettings.getValue('referralSignupRep', 10)),
    qualificationRep: Number(await SystemSettings.getValue('referralQualificationRep', 50)),
    referredRep: Number(await SystemSettings.getValue('referralReferredRep', 10)),
    threshold: Number(await SystemSettings.getValue('referralQualificationThreshold', 20))
  };
}

/**
 * Add reputation to a user. Uses $inc so concurrent awards never lose an
 * update (a read-modify-write would).
 */
async function addReputation(userId, amount) {
  if (!userId || !amount) return;
  await User.updateOne({ _id: userId }, { $inc: { reputation: Math.max(0, amount) } });
}

/** Bump the referrer's denormalized referralCount and sync milestone badges. */
async function bumpReferralCountAndBadges(referrerUserId) {
  const updated = await User.findOneAndUpdate(
    { _id: referrerUserId },
    { $inc: { referralCount: 1 } },
    { new: true }
  );
  if (!updated) return;
  const count = updated.referralCount || 0;
  const badges = [];
  const alreadyHas = (n) => updated.badges?.some((b) => b.name === n);
  if (count >= 1 && !alreadyHas(REFERRAL_BADGES.connector.name)) {
    badges.push({ ...REFERRAL_BADGES.connector, earnedAt: new Date() });
  }
  if (count >= 5 && !alreadyHas(REFERRAL_BADGES.evangelist.name)) {
    badges.push({ ...REFERRAL_BADGES.evangelist, earnedAt: new Date() });
  }
  if (badges.length) {
    await User.updateOne({ _id: referrerUserId }, { $push: { badges: { $each: badges } } });
  }
}

/**
 * Award the signup stage: a small reward to the referrer, paid once when the
 * referred account is created. Returns true if this call paid the stage.
 */
async function awardSignup(referralId) {
  const settings = await getReferralSettings();
  if (!settings.enabled) return false;

  // Claim the stage atomically. If the flag is already true (or the referral
  // is rejected), no doc matches and nothing is paid.
  const claimed = await Referral.findOneAndUpdate(
    { _id: referralId, signupRepAwarded: false, status: { $ne: 'rejected' } },
    { $set: { signupRepAwarded: true } },
    { new: true }
  );
  if (!claimed) return false;

  await addReputation(claimed.referrerUserId, settings.signupRep);
  return true;
}

/**
 * Award the qualification stage: a larger reward to the referrer plus a
 * smaller reward to the referred user, paid once when the referred user
 * crosses the activation threshold. Returns true if this call paid it.
 */
async function awardQualification(referralId) {
  const settings = await getReferralSettings();
  if (!settings.enabled) return false;

  const claimed = await Referral.findOneAndUpdate(
    { _id: referralId, qualificationRepAwarded: false, status: { $ne: 'rejected' } },
    { $set: { qualificationRepAwarded: true, status: 'qualified', qualifiedAt: new Date() } },
    { new: true }
  );
  if (!claimed) return false;

  await addReputation(claimed.referrerUserId, settings.qualificationRep);
  await addReputation(claimed.referredUserId, settings.referredRep);
  await bumpReferralCountAndBadges(claimed.referrerUserId);
  return true;
}

/**
 * Called after a referred user's collection grows. Counts the user's REAL
 * cards (sum of quantity) against the activation threshold and fires the
 * qualification award exactly once. We count live cards rather than trust a
 * denormalized counter so the number always reflects the current collection.
 * Fire-and-forget safe: swallows errors so it never breaks the caller.
 *
 * @param {string} referredUserId
 * @param {mongoose.Model} CardModel - the Card model (registered dynamically)
 */
async function checkQualification(referredUserId, CardModel) {
  try {
    if (!referredUserId || !CardModel) return false;
    const settings = await getReferralSettings();
    if (!settings.enabled) return false;

    const referral = await Referral.findOne({ referredUserId, status: { $ne: 'rejected' } });
    if (!referral || referral.qualificationRepAwarded) return false;

    const [agg] = await CardModel.aggregate([
      { $match: { userId: referredUserId } },
      { $group: { _id: null, total: { $sum: '$quantity' } } }
    ]);
    const cardsOwned = agg?.total || 0;
    if (cardsOwned < settings.threshold) return false;

    return await awardQualification(referral._id);
  } catch (err) {
    console.error('Referral qualification check error:', err.message);
    return false;
  }
}

module.exports = {
  REFERRAL_BADGES,
  getReferralSettings,
  awardSignup,
  awardQualification,
  checkQualification
};
