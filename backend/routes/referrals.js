const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const Referral = require('../models/Referral');
const ReferralCode = require('../models/ReferralCode');
const User = require('../models/User');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { getClientIp } = require('../middleware/activityLogger');
const { awardSignup, getReferralSettings } = require('../utils/referralRewards');

// Unambiguous alphabet — no 0/O or 1/I/l, so codes stay readable when spoken
// at game nights or read off a phone screen.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function generateCode() {
  let out = '';
  const bytes = crypto.randomBytes(CODE_LENGTH);
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/**
 * Return (creating if needed) the calling user's stable referral code.
 * Safe to call repeatedly — `userId` has a unique index, so a second call
 * just returns the existing code.
 */
async function getOrCreateCode(userId) {
  const existing = await ReferralCode.findOne({ userId });
  if (existing) return existing;

  // Retry on the (astronomically unlikely) chance of a code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const clash = await ReferralCode.findOne({ code });
    if (clash) continue;
    try {
      return await ReferralCode.create({ code, userId });
    } catch (err) {
      if (err.code !== 11000) throw err; // 11000 = code/userId race; retry
    }
  }
  throw new Error('Could not generate a unique referral code');
}

/**
 * Attach a referral to a newly-registered user and pay the signup reward.
 * Called from the register route in backend/routes/auth.js AFTER the user is
 * created. Never throws — a referral failure must not fail the signup itself.
 *
 * @param {string} code - the referral code entered at signup (already trimmed/uppercased)
 * @param {Object} newUser - the freshly created User document
 * @param {string} ip - the signup IP address
 */
async function claimReferral(code, newUser, ip) {
  if (!code || !newUser) return null;
  try {
    const referralCode = await ReferralCode.findOne({ code: String(code).toUpperCase(), isActive: true });
    if (!referralCode) return null;

    // Referring yourself is never valid.
    if (String(referralCode.userId) === String(newUser._id)) return null;

    const referrer = await User.findById(referralCode.userId);
    if (!referrer || !referrer.isActive) return null;

    // Flag (not block) when the signup shares an IP with the referrer —
    // families and roommates share a router, so blocking would punish real
    // referrals. The flag routes these to admin review instead.
    let ipSimilarityFlag = false;
    if (ip && referrer.lastSeenIp) {
      ipSimilarityFlag = referrer.lastSeenIp === ip;
    }

    const referral = await Referral.create({
      code: referralCode.code,
      referrerUserId: referrer._id,
      referredUserId: newUser._id,
      ipSimilarityFlag
    });

    // Stamp who invited this user, for the profile/audit trail.
    await User.updateOne({ _id: newUser._id }, { $set: { referredBy: referrer._id } });

    // Pay the (idempotent) signup reward. Fire-and-forget so a rewards blip
    // can't fail the registration that already succeeded.
    awardSignup(referral._id).catch(() => {});

    return referral;
  } catch (err) {
    console.error('Referral claim error:', err.message);
    return null;
  }
}

// --- User endpoints -------------------------------------------------------

// GET /api/referrals/config — public feature config (signup form reads this)
router.get('/config', async (req, res) => {
  try {
    const settings = await getReferralSettings();
    res.json({
      enabled: settings.enabled,
      signupRep: settings.signupRep,
      qualificationRep: settings.qualificationRep,
      referredRep: settings.referredRep,
      threshold: settings.threshold
    });
  } catch (err) {
    res.status(500).json({ message: 'Error loading referral config', error: err.message });
  }
});

// GET /api/referrals/me — my code, stats, and invite history
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [codeDoc, referrals, settings] = await Promise.all([
      ReferralCode.findOne({ userId: req.user._id }),
      Referral.find({ referrerUserId: req.user._id })
        .sort({ createdAt: -1 })
        .populate('referredUserId', 'username displayName createdAt'),
      getReferralSettings()
    ]);

    const invited = referrals.length;
    const qualified = referrals.filter((r) => r.status === 'qualified').length;
    const flagged = referrals.filter((r) => r.ipSimilarityFlag).length;

    res.json({
      code: codeDoc?.code || null,
      settings,
      stats: { invited, qualified, flagged },
      referrals: referrals.map((r) => ({
        _id: r._id,
        status: r.status,
        ipSimilarityFlag: r.ipSimilarityFlag,
        createdAt: r.createdAt,
        qualifiedAt: r.qualifiedAt,
        referred: r.referredUserId
          ? { username: r.referredUserId.username, createdAt: r.referredUserId.createdAt }
          : null
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Error loading referrals', error: err.message });
  }
});

// POST /api/referrals/code — ensure I have a code, return it
router.post('/code', requireAuth, async (req, res) => {
  try {
    const codeDoc = await getOrCreateCode(req.user._id);
    res.json({ code: codeDoc.code });
  } catch (err) {
    res.status(500).json({ message: 'Error generating referral code', error: err.message });
  }
});

// GET /api/referrals/:code/valid — public lookup used by the signup form
router.get('/:code/valid', async (req, res) => {
  try {
    const codeDoc = await ReferralCode.findOne({
      code: String(req.params.code).toUpperCase(),
      isActive: true
    }).populate('userId', 'username displayName');
    if (!codeDoc) return res.json({ valid: false });
    res.json({
      valid: true,
      username: codeDoc.userId?.username || null,
      displayName: codeDoc.userId?.displayName || null
    });
  } catch (err) {
    res.status(500).json({ message: 'Error validating referral code', error: err.message });
  }
});

// --- Admin endpoints ------------------------------------------------------

// GET /api/referrals/admin/all — list referrals, filterable by status/flag
router.get('/admin/all', requireAuth, requirePermission('referrals:manage'), async (req, res) => {
  try {
    const { status, flagged } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (flagged === 'true') filter.ipSimilarityFlag = true;

    const referrals = await Referral.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('referrerUserId', 'username')
      .populate('referredUserId', 'username createdAt');

    res.json(
      referrals.map((r) => ({
        _id: r._id,
        code: r.code,
        status: r.status,
        ipSimilarityFlag: r.ipSimilarityFlag,
        createdAt: r.createdAt,
        qualifiedAt: r.qualifiedAt,
        signupRepAwarded: r.signupRepAwarded,
        qualificationRepAwarded: r.qualificationRepAwarded,
        referrer: r.referrerUserId?.username || null,
        referred: r.referredUserId?.username || null
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Error fetching referrals', error: err.message });
  }
});

// POST /api/referrals/admin/:id/reject — reject a flagged/abused referral
router.post('/admin/:id/reject', requireAuth, requirePermission('referrals:manage'), async (req, res) => {
  try {
    const referral = await Referral.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true }
    );
    if (!referral) return res.status(404).json({ message: 'Referral not found' });
    res.json({ message: 'Referral rejected', referral });
  } catch (err) {
    res.status(500).json({ message: 'Error rejecting referral', error: err.message });
  }
});

module.exports = router;
module.exports.claimReferral = claimReferral;
module.exports.getOrCreateCode = getOrCreateCode;
