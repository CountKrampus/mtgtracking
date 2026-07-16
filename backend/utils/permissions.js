// Role → permission strings mapping.
// These match the labels shown in Phase 2's RoleManagement UI component.
const ROLE_PERMISSIONS = {
  admin: [
    'all'
  ],
  moderator: [
    'chat:moderate',
    'comments:moderate',
    'user:warn',
    'user:mute',
    'content:flag'
  ],
  content_manager: [
    'cards:audit',
    'prices:manage',
    'data:export',
    'content:flag'
  ],
  community_manager: [
    'community:events',
    'announcements:manage',
    'feedback:manage',
    'playgroups:manage'
  ],
  support: [
    'user:view',
    'feedback:read',
    'user:mute',
    'ticket:manage'
  ],
  // Standard user roles (new and legacy)
  user:   ['collection:manage', 'deck:create', 'community:chat'],
  editor: ['collection:manage', 'deck:create', 'community:chat'], // legacy alias for user
  viewer: ['collection:view']
};

// Freeze to prevent accidental mutation by callers
Object.values(ROLE_PERMISSIONS).forEach(arr => Object.freeze(arr));
Object.freeze(ROLE_PERMISSIONS);

// Staff roles that get a staffSince timestamp when assigned
const STAFF_ROLES = ['admin', 'moderator', 'content_manager', 'community_manager', 'support'];

// Badge granted/revoked for each staff role — mirrors STAFF_ROLES 1:1.
// `admin` maps to the existing "Site Owner" Badge record (fixes the legacy
// "Owner" naming drift — see backend/scripts/backfillStaffBadges.js).
const STAFF_ROLE_BADGES = Object.freeze({
  admin: { name: 'Site Owner', description: 'The Creator', icon: 'lucide:Crown' },
  moderator: { name: 'Moderator', description: '', icon: 'lucide:Flame' },
  content_manager: { name: 'Content Manager', description: '', icon: 'lucide:Flame' },
  community_manager: { name: 'Community Manager', description: '', icon: 'lucide:Flame' },
  support: { name: 'Support', description: '', icon: 'lucide:Flame' },
});

/**
 * Sync a user's staff badge to match a role change.
 * Revokes the badge tied to oldRole (if any, and if newRole doesn't grant the
 * same badge) and grants the badge tied to newRole (if any, and not already
 * present). Mutates user.badges in place using the same array-reassignment
 * pattern as the badge grant/revoke routes in backend/routes/admin.js.
 * Does not save — caller is responsible for persisting the user.
 * @param {{ badges?: Array<{name: string}> }} user
 * @param {string} oldRole
 * @param {string} newRole
 */
function syncStaffBadge(user, oldRole, newRole) {
  const oldBadge = STAFF_ROLE_BADGES[oldRole];
  const newBadge = STAFF_ROLE_BADGES[newRole];

  user.badges = user.badges || [];

  // Revoke: previous role had a staff badge that the new role doesn't also grant
  if (oldBadge && (!newBadge || oldBadge.name !== newBadge.name)) {
    user.badges = user.badges.filter(b => b.name !== oldBadge.name);
  }

  // Grant: new role has a staff badge the user doesn't already have
  if (newBadge && !user.badges.some(b => b.name === newBadge.name)) {
    user.badges.push({
      name: newBadge.name,
      description: newBadge.description,
      icon: newBadge.icon,
      earnedAt: new Date()
    });
  }
}

/**
 * Returns the permission strings for a given role.
 * Admin always gets ['all'] — check with hasPermission() which expands it.
 * @param {string} role
 * @returns {string[]}
 */
function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['user'];
}

/**
 * Returns true if the user object has a given permission.
 * Admins pass every check (they have 'all').
 * @param {{ role: string }} user
 * @param {string} permission
 * @returns {boolean}
 */
function hasPermission(user, permission) {
  if (!user || !user.role) return false;
  if (user.role === 'admin') return true;
  const perms = getPermissionsForRole(user.role);
  return perms.includes(permission);
}

/**
 * Returns true for roles that receive a staffSince timestamp.
 * @param {string} role
 * @returns {boolean}
 */
function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

module.exports = {
  ROLE_PERMISSIONS,
  STAFF_ROLES,
  STAFF_ROLE_BADGES,
  getPermissionsForRole,
  hasPermission,
  isStaffRole,
  syncStaffBadge
};
