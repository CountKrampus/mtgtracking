const Ban = require('../models/Ban');

async function checkMute(req, res, next) {
  if (!req.user) return next();

  const activeMute = await Ban.findOne({
    userId: req.user._id,
    type: 'mute',
    isActive: true,
    expiresAt: { $gt: new Date() }
  });

  if (activeMute) {
    return res.status(403).json({
      message: `You are muted until ${activeMute.expiresAt.toISOString()}`,
      muteLevel: activeMute.muteLevel,
      expiresAt: activeMute.expiresAt
    });
  }

  next();
}

module.exports = { checkMute };
