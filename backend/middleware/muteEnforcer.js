const Ban = require('../models/Ban');

async function checkMute(req, res, next) {
  if (!req.user) return next();

  const activeMute = await Ban.findOne({
    userId: req.user._id,
    type: 'mute',
    isActive: true
  });

  if (!activeMute) return next();

  // Check if mute has expired
  if (activeMute.mutedUntil && activeMute.mutedUntil < new Date()) {
    activeMute.isActive = false;
    await activeMute.save();
    return next();
  }

  return res.status(403).json({
    message: activeMute.mutedUntil
      ? `You are muted until ${activeMute.mutedUntil.toISOString()}`
      : 'You are permanently muted',
    muteLevel: activeMute.level,
    mutedUntil: activeMute.mutedUntil || null
  });
}

module.exports = { checkMute };
