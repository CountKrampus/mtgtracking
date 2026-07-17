const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9_]+$/, 'Role name can only contain lowercase letters, numbers, and underscores']
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'Display name cannot exceed 50 characters']
  },
  permissions: {
    type: [String],
    default: []
  },
  isBuiltIn: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

roleSchema.index({ isBuiltIn: 1 });

/**
 * Seeds the Role collection from the historical ROLE_PERMISSIONS map
 * (backend/utils/permissions.js), one Role doc per key, isBuiltIn: true.
 * Idempotent (upsert with $setOnInsert, mirroring
 * SystemSettings.initializeDefaults() in backend/models/SystemSettings.js) —
 * safe to call on every server start; never overwrites an admin's
 * subsequent edits to a built-in role's permissions.
 */
roleSchema.statics.seedBuiltInRoles = async function() {
  const { ROLE_PERMISSIONS } = require('../utils/permissions');

  const displayNames = {
    admin: 'Admin',
    moderator: 'Moderator',
    content_manager: 'Content Manager',
    community_manager: 'Community Manager',
    support: 'Support',
    user: 'User',
    editor: 'Editor',
    viewer: 'Viewer'
  };

  for (const [name, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    await this.findOneAndUpdate(
      { name },
      {
        $setOnInsert: {
          name,
          displayName: displayNames[name] || name,
          permissions: [...permissions],
          isBuiltIn: true
        }
      },
      { upsert: true }
    );
  }
};

module.exports = mongoose.model('Role', roleSchema);
