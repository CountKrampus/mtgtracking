const mongoose = require('mongoose');

const banSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['ban', 'mute'],
    required: true
  },
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  muteLevel: {
    type: Number,
    min: 1,
    max: 3
  },
  durationMs: Number,
  expiresAt: Date,
  autoEscalate: {
    type: Boolean,
    default: false
  },
  previousMutes: [{
    muteLevel: Number,
    startedAt: Date,
    endedAt: Date,
    reason: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

banSchema.index({ userId: 1, isActive: 1 });
banSchema.index({ expiresAt: 1 });

banSchema.pre('save', function(next) {
  if (this.type === 'mute') {
    if (!this.muteLevel) {
      throw new Error('muteLevel is required for mutes');
    }
  } else {
    this.muteLevel = undefined;
  }

  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Ban', banSchema);
