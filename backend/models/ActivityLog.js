const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      // Auth actions
      'login',
      'logout',
      'register',
      'password_change',
      'session_revoke',
      'session_revoke_all',

      // Collection actions
      'card_create',
      'card_update',
      'card_delete',
      'card_bulk_import',
      'card_bulk_update',
      'card_bulk_delete',
      'price_update',
      'price_bulk_update',

      // Deck actions
      'deck_create',
      'deck_update',
      'deck_delete',

      // Wishlist actions
      'wishlist_add',
      'wishlist_update',
      'wishlist_delete',
      'wishlist_acquire',

      // Location actions
      'location_create',
      'location_update',
      'location_delete',

      // Tag actions
      'tag_create',
      'tag_update',
      'tag_delete',

      // Admin actions
      'user_create',
      'user_update',
      'user_delete',
      'user_role_change',
      'user_deactivate',
      'user_activate',
      'data_migrate',
      'maintenance_toggle',
      'settings_update',

      // Export actions
      'export_json',
      'export_csv',
      'data_export_gdpr'
    ]
  },
  category: {
    type: String,
    required: true,
    enum: ['auth', 'collection', 'deck', 'wishlist', 'location', 'tag', 'admin', 'export']
  },
  targetType: {
    type: String,
    enum: ['card', 'deck', 'wishlist', 'location', 'tag', 'user', 'session', 'settings', null]
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId
  },
  targetName: {
    type: String
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: { expires: 7776000 } // TTL: 90 days (90 * 24 * 60 * 60 seconds)
  }
});

// Indexes for efficient querying
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ category: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

// Static method to log an activity
activityLogSchema.statics.log = async function(params) {
  const {
    userId,
    action,
    category,
    targetType = null,
    targetId = null,
    targetName = null,
    details = null,
    ipAddress = null
  } = params;

  const log = new this({
    userId,
    action,
    category,
    targetType,
    targetId,
    targetName,
    details,
    ipAddress
  });

  return log.save();
};

// Static method to get recent activity for a user
activityLogSchema.statics.getForUser = function(userId, options = {}) {
  const { limit = 50, skip = 0, category = null, action = null } = options;

  const query = { userId };
  if (category) query.category = category;
  if (action) query.action = action;

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get system-wide activity (admin)
activityLogSchema.statics.getSystemActivity = function(options = {}) {
  const { limit = 100, skip = 0, category = null, action = null, userId = null } = options;

  const query = {};
  if (category) query.category = category;
  if (action) query.action = action;
  if (userId) query.userId = userId;

  return this.find(query)
    .populate('userId', 'username email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;
