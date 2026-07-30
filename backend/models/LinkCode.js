const mongoose = require('mongoose');
const crypto = require('crypto');

const linkCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // TTL index - document deleted when expiresAt is reached
  }
});

// Static method to generate a fresh 10-minute code for a user, removing any
// previous unused code first so only one is ever active per user.
linkCodeSchema.statics.generateForUser = async function(userId) {
  await this.deleteMany({ userId });
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  return this.create({ code, userId, expiresAt });
};

module.exports = mongoose.model('LinkCode', linkCodeSchema);
