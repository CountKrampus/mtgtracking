const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  url: {
    type: String,
    required: true
  },
  secret: {
    type: String,
    required: true
  },
  events: {
    type: [{ type: String, enum: ['price_alert'] }],
    default: ['price_alert']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastTriggeredAt: {
    type: Date,
    default: null
  },
  lastStatus: {
    type: Number,
    default: null
  },
  failureCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Webhook', webhookSchema);
