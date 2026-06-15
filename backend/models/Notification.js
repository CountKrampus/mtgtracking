const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      'price_alert', 'borrow_request', 'playgroup_invite',
      'game_night', 'game_room', 'direct_message', 'modmail',
    ],
    required: true,
  },
  title: { type: String, required: true, maxlength: 100 },
  body: { type: String, default: '', maxlength: 300 },
  link: { type: String, default: '' },
  read: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
// Auto-delete after 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Notification', notificationSchema);
