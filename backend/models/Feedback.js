const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  submitter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  category: { type: String, enum: ['bug', 'feature', 'other'], default: 'other' },
  status: { type: String, enum: ['pending', 'reviewed', 'closed'], default: 'pending' },
  pageUrl: { type: String },
  userAgent: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
