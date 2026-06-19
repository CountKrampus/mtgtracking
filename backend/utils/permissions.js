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

module.exports = { ROLE_PERMISSIONS, STAFF_ROLES, getPermissionsForRole, hasPermission, isStaffRole };
