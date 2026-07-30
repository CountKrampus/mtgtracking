const mongoose = require('mongoose');

const discordLinkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  discordUserId: {
    type: String,
    required: true,
    unique: true
  },
  linkedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DiscordLink', discordLinkSchema);
