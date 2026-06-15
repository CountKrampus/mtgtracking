const mongoose = require('mongoose');

const spamFilterConfigSchema = new mongoose.Schema({
  singleton: {
    type: String,
    enum: ['SINGLETON'],
    unique: true
  },
  sensitivity: {
    type: String,
    enum: ['strict', 'moderate', 'lenient'],
    default: 'moderate'
  },
  bannedWords: [{
    type: String,
    lowercase: true
  }],
  minReputationToAutoFlag: {
    type: Number,
    default: -50,
    min: -1000
  },
  maxPostsPerHourPerUser: {
    type: Number,
    default: 10,
    min: 1,
    max: 1000
  },
  flagThreshold: {
    type: Number,
    default: 2,
    min: 1,
    validate: {
      validator: function(value) {
        return value <= this.maxPostsPerHourPerUser;
      },
      message: 'flagThreshold cannot exceed maxPostsPerHourPerUser'
    }
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

spamFilterConfigSchema.index({ sensitivity: 1 });
spamFilterConfigSchema.index({ updatedAt: -1 });

spamFilterConfigSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

spamFilterConfigSchema.statics.getConfig = async function() {
  let config = await this.findOne({ singleton: 'SINGLETON' });
  if (!config) {
    config = await this.create({ singleton: 'SINGLETON' });
  }
  return config;
};

module.exports = mongoose.model('SpamFilterConfig', spamFilterConfigSchema);
