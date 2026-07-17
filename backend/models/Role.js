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

/**
 * Grants a small number of NEW catalog permissions — introduced when route
 * protection was migrated from requireRole()/requireModerator()/
 * requireContentManager() to requirePermission() (Phase 2 of
 * docs/superpowers/plans/2026-07-09-custom-roles-permissions.md) — to the
 * built-in roles that already had route-level access via the old
 * requireRole()-family middleware, so migrating route protection does not
 * silently take access away from anyone.
 *
 * Deliberately NOT folded into seedBuiltInRoles()/ROLE_PERMISSIONS, so the
 * seed-from-ROLE_PERMISSIONS regression test (role-seed.test.js,
 * 'creates one Role doc per ROLE_PERMISSIONS key... with matching
 * permissions') stays an exact-match check against the historical map.
 *
 * Idempotent ($addToSet) — safe to call on every server start.
 */
roleSchema.statics.grantMigrationPermissions = async function() {
  // moderator gained the account-ban and appeal-review routes
  // (backend/routes/admin.js account-bans + /appeals + /ban-appeals
  // endpoints, previously requireModerator()) when migrated to
  // requirePermission('user:ban') / requirePermission('user:appeal:review').
  await this.updateOne(
    { name: 'moderator' },
    { $addToSet: { permissions: { $each: ['user:ban', 'user:appeal:review'] } } }
  );

  // content_manager gained the force-price-update job endpoints
  // (backend/routes/admin.js POST/GET /force-price-update*, previously
  // requireContentManager()) when migrated to
  // requirePermission('prices:force-update').
  await this.updateOne(
    { name: 'content_manager' },
    { $addToSet: { permissions: 'prices:force-update' } }
  );
};

module.exports = mongoose.model('Role', roleSchema);
