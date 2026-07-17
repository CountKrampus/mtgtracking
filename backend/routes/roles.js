const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const User = require('../models/User');
const { verifyToken, requireAuth, requirePermission } = require('../middleware/auth');
const { logActivity, getClientIp } = require('../middleware/activityLogger');
const { getPermissionsCatalog, refreshRoleCache } = require('../utils/permissions');

router.use(verifyToken);
router.use(requireAuth);

/**
 * GET /api/admin/roles - list all roles (built-in and custom)
 * Accepts either roles:manage (full role editor) or user:role:manage (the
 * existing role-ASSIGNMENT UI, which only needs the name/displayName list to
 * populate its dropdown) — see RoleManagement.js vs PermissionsManagement.js.
 */
router.get('/', requirePermission('roles:manage', 'user:role:manage'), async (req, res) => {
  try {
    const roles = await Role.find().sort({ isBuiltIn: -1, name: 1 });
    res.json({ roles });
  } catch (error) {
    console.error('List roles error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/admin/roles/permissions-catalog - full permission catalog grouped by domain
router.get('/permissions-catalog', requirePermission('roles:manage'), (req, res) => {
  res.json({ catalog: getPermissionsCatalog() });
});

// POST /api/admin/roles - create a custom role
router.post('/', requirePermission('roles:manage'), async (req, res) => {
  try {
    const { name, displayName, permissions = [] } = req.body;

    if (!name || !/^[a-z0-9_]+$/.test(name)) {
      return res.status(400).json({
        message: 'name is required and can only contain lowercase letters, numbers, and underscores',
        code: 'INVALID_ROLE_NAME'
      });
    }
    if (!displayName) {
      return res.status(400).json({ message: 'displayName is required', code: 'MISSING_DISPLAY_NAME' });
    }
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: 'permissions must be an array', code: 'INVALID_PERMISSIONS' });
    }
    if (permissions.includes('all')) {
      return res.status(400).json({
        message: "'all' cannot be assigned to a custom role",
        code: 'CANNOT_ASSIGN_ALL'
      });
    }

    const existing = await Role.findOne({ name: name.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: `Role '${name}' already exists`, code: 'ROLE_NAME_EXISTS' });
    }

    const role = await Role.create({
      name: name.toLowerCase(),
      displayName,
      permissions,
      isBuiltIn: false
    });

    await refreshRoleCache();

    await logActivity({
      userId: req.user._id,
      action: 'role_create',
      category: 'admin',
      targetType: 'role',
      targetId: role._id,
      targetName: role.name,
      details: { permissions },
      ipAddress: getClientIp(req)
    });

    res.status(201).json({ role });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/admin/roles/:id - update a role's displayName/permissions (built-in roles included)
router.put('/:id', requirePermission('roles:manage'), async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found', code: 'ROLE_NOT_FOUND' });
    }

    const { displayName, permissions } = req.body;

    if (permissions !== undefined) {
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ message: 'permissions must be an array', code: 'INVALID_PERMISSIONS' });
      }
      if (!role.isBuiltIn && permissions.includes('all')) {
        return res.status(400).json({
          message: "'all' cannot be assigned to a custom role",
          code: 'CANNOT_ASSIGN_ALL'
        });
      }

      // Guardrail 1: can't remove 'all' from the last role that has it
      if (role.permissions.includes('all') && !permissions.includes('all')) {
        const otherAllCount = await Role.countDocuments({
          _id: { $ne: role._id },
          permissions: 'all'
        });
        if (otherAllCount === 0) {
          return res.status(400).json({
            message: "Cannot remove 'all' access from the last role that grants it. Assign 'all' to another role first.",
            code: 'LAST_ALL_ACCESS_ROLE'
          });
        }
      }

      // Guardrail 2: can't remove roles:manage from your OWN current role if no other role has it
      const editingOwnRole = req.user.role === role.name;
      const hadRolesManage = role.permissions.includes('roles:manage') || role.permissions.includes('all');
      const willHaveRolesManage = permissions.includes('roles:manage') || permissions.includes('all');
      if (editingOwnRole && hadRolesManage && !willHaveRolesManage) {
        // Deliberately checks literal 'roles:manage' only, not 'all' — admin
        // always holds 'all' as a built-in invariant, so counting it here
        // would make this guard permanently unreachable for any other role
        // (admin's mere existence would always count as "another holder").
        const otherHolders = await Role.countDocuments({
          _id: { $ne: role._id },
          permissions: 'roles:manage'
        });
        if (otherHolders === 0) {
          return res.status(400).json({
            message: "Cannot remove 'roles:manage' from your own role — no other role would be able to manage roles.",
            code: 'LAST_ROLES_MANAGE_HOLDER'
          });
        }
      }

      role.permissions = permissions;
    }

    if (displayName !== undefined) {
      role.displayName = displayName;
    }

    await role.save();
    await refreshRoleCache();

    await logActivity({
      userId: req.user._id,
      action: 'role_update',
      category: 'admin',
      targetType: 'role',
      targetId: role._id,
      targetName: role.name,
      details: { displayName, permissions },
      ipAddress: getClientIp(req)
    });

    res.json({ role });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/admin/roles/:id - delete a custom role
router.delete('/:id', requirePermission('roles:manage'), async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found', code: 'ROLE_NOT_FOUND' });
    }
    if (role.isBuiltIn) {
      return res.status(400).json({ message: 'Cannot delete a built-in role', code: 'CANNOT_DELETE_BUILT_IN' });
    }

    const usersWithRole = await User.countDocuments({ role: role.name });
    if (usersWithRole > 0) {
      return res.status(400).json({
        message: `Cannot delete role '${role.name}' — ${usersWithRole} user(s) currently hold it. Reassign them first.`,
        code: 'ROLE_IN_USE'
      });
    }

    await role.deleteOne();
    await refreshRoleCache();

    await logActivity({
      userId: req.user._id,
      action: 'role_delete',
      category: 'admin',
      targetType: 'role',
      targetId: role._id,
      targetName: role.name,
      ipAddress: getClientIp(req)
    });

    res.json({ message: `Role '${role.name}' deleted` });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
