const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const axios = require('axios');

const User = require('../models/User');
const Session = require('../models/Session');
const ActivityLog = require('../models/ActivityLog');
const SystemSettings = require('../models/SystemSettings');
const UserBan = require('../models/UserBan');
const UserWarning = require('../models/UserWarning');
const BanAppeal = require('../models/BanAppeal');
const ModerationHistory = require('../models/ModerationHistory');
const CollectionAudit = require('../models/CollectionAudit');
const Badge = require('../models/Badge');
const ForumPost = require('../models/ForumPost');
const ForumThread = require('../models/ForumThread');
const ForumCategory = require('../models/ForumCategory');
const { verifyToken, requireAuth, requireAdmin, requireModerator, requireContentManager, requireSupport, isMultiUserEnabled } = require('../middleware/auth');
const { logActivity, getClientIp } = require('../middleware/activityLogger');
const { isStaffRole, ROLE_PERMISSIONS, syncStaffBadge } = require('../utils/permissions');

// All admin routes require authentication
router.use(verifyToken);
router.use(requireAuth);
// Per-route permission middleware added below — no blanket requireAdmin

/**
 * GET /api/admin/users
 * List all users
 */
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, skip = 0, role, isActive, search } = req.query;

    const query = {};

    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    res.json({
      users: users.map(u => u.toSafeObject()),
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/admin/users/:id
 * Get a specific user
 */
router.get('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Get user's session count
    const activeSessions = await Session.countDocuments({
      userId: user._id,
      isValid: true,
      expiresAt: { $gt: new Date() }
    });

    // Get recent activity count
    const recentActivityCount = await ActivityLog.countDocuments({
      userId: user._id,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    });

    res.json({
      user: user.toSafeObject(),
      activeSessions,
      recentActivityCount
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/admin/users/:id
 * Update a user's role or status
 */
router.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const { role, isActive, displayName } = req.body;

    // Prevent admin from demoting themselves if they're the only admin
    if (role && role !== 'admin' && user._id.toString() === req.user._id.toString()) {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return res.status(400).json({
          message: 'Cannot demote the only admin. Please assign admin role to another user first.',
          code: 'LAST_ADMIN'
        });
      }
    }

    // Prevent deactivating the only admin
    if (isActive === false && user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return res.status(400).json({
          message: 'Cannot deactivate the only admin. Please assign admin role to another user first.',
          code: 'LAST_ADMIN'
        });
      }
    }

    // Track changes for logging
    const changes = {};

    if (role && role !== user.role) {
      const oldRole = user.role;
      changes.oldRole = oldRole;
      changes.newRole = role;
      user.role = role;
      user.staffSince = isStaffRole(role) ? (user.staffSince || new Date()) : null;
      syncStaffBadge(user, oldRole, role);

      // Log role change
      await logActivity({
        userId: req.user._id,
        action: 'user_role_change',
        category: 'admin',
        targetType: 'user',
        targetId: user._id,
        targetName: user.username,
        details: changes,
        ipAddress: getClientIp(req)
      });
    }

    if (isActive !== undefined && isActive !== user.isActive) {
      user.isActive = isActive;

      // Log activation/deactivation
      await logActivity({
        userId: req.user._id,
        action: isActive ? 'user_activate' : 'user_deactivate',
        category: 'admin',
        targetType: 'user',
        targetId: user._id,
        targetName: user.username,
        ipAddress: getClientIp(req)
      });

      // If deactivating, invalidate all sessions
      if (!isActive) {
        await Session.invalidateAllForUser(user._id);
      }
    }

    if (displayName !== undefined) {
      user.displayName = displayName;
    }

    await user.save();

    res.json(user.toSafeObject());
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user
 */
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Prevent deleting the only admin
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return res.status(400).json({
          message: 'Cannot delete the only admin. Please assign admin role to another user first.',
          code: 'LAST_ADMIN'
        });
      }
    }

    // Prevent self-deletion
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        message: 'Cannot delete your own account from admin panel. Use account settings instead.',
        code: 'SELF_DELETE'
      });
    }

    // Invalidate all sessions
    await Session.invalidateAllForUser(user._id);

    // Anonymize activity logs
    await ActivityLog.updateMany(
      { userId: user._id },
      { $set: { userId: null, details: { anonymized: true, deletedBy: req.user._id } } }
    );

    // Log the deletion
    await logActivity({
      userId: req.user._id,
      action: 'user_delete',
      category: 'admin',
      targetType: 'user',
      targetId: user._id,
      targetName: user.username,
      ipAddress: getClientIp(req)
    });

    // Delete the user
    await user.deleteOne();

    res.json({
      message: 'User deleted successfully',
      deletedUser: user.username
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/admin/users/:userId/role
 * Role Management — dedicated role assignment endpoint
 * Called by the RoleManagement frontend component with body: { newRole }
 */
router.put('/users/:userId/role', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newRole } = req.body;

    const validRoles = Object.keys(ROLE_PERMISSIONS);
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ message: 'Invalid role', code: 'INVALID_ROLE' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found', code: 'USER_NOT_FOUND' });
    }

    // Prevent demoting the only remaining admin
    if (newRole !== 'admin' && targetUser.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return res.status(400).json({
          message: 'Cannot demote the only admin. Please assign admin role to another user first.',
          code: 'LAST_ADMIN'
        });
      }
    }

    const oldRole = targetUser.role;
    targetUser.role = newRole;
    targetUser.staffSince = isStaffRole(newRole) ? (targetUser.staffSince || new Date()) : null;
    syncStaffBadge(targetUser, oldRole, newRole);

    await targetUser.save();

    await logActivity({
      userId: req.user._id,
      action: 'user_role_change',
      category: 'admin',
      targetType: 'user',
      targetId: targetUser._id,
      targetName: targetUser.username,
      details: { oldRole, newRole },
      ipAddress: getClientIp(req)
    });

    res.json({ message: `User role changed to ${newRole}`, newRole });
  } catch (error) {
    console.error('Error updating user role:', error.message);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// ── Badge management ──────────────────────────────────────────────────────────

// GET /api/admin/badges — list all badges
router.get('/badges', requireAdmin, async (req, res) => {
  try {
    const badges = await Badge.find().sort({ name: 1 }).lean();
    res.json({ badges });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /api/admin/badges — create a new badge definition
router.post('/badges', requireAdmin, async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Badge name is required' });
    const existing = await Badge.findOne({ name: name.trim() });
    if (existing) return res.status(409).json({ message: 'A badge with that name already exists' });
    const badge = new Badge({ name: name.trim(), description: description || '', icon: icon || '' });
    await badge.save();
    res.status(201).json({ badge });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// PUT /api/admin/badges/:id — update a badge definition
router.put('/badges/:id', requireAdmin, async (req, res) => {
  try {
    const { name, description, icon } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Badge name is required' });
    const badge = await Badge.findById(req.params.id);
    if (!badge) return res.status(404).json({ message: 'Badge not found' });
    const conflict = await Badge.findOne({ name: name.trim(), _id: { $ne: badge._id } });
    if (conflict) return res.status(409).json({ message: 'A badge with that name already exists' });
    badge.name = name.trim();
    badge.description = description ?? badge.description;
    badge.icon = icon ?? badge.icon;
    await badge.save();
    res.json({ badge });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE /api/admin/badges/:id — delete a badge definition
router.delete('/badges/:id', requireAdmin, async (req, res) => {
  try {
    const badge = await Badge.findByIdAndDelete(req.params.id);
    if (!badge) return res.status(404).json({ message: 'Badge not found' });
    res.json({ message: `Badge "${badge.name}" deleted` });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /api/admin/badges/:badgeId/grant/:userId — grant a badge to a user
router.post('/badges/:badgeId/grant/:userId', requireAdmin, async (req, res) => {
  try {
    const badge = await Badge.findById(req.params.badgeId).lean();
    if (!badge) return res.status(404).json({ message: 'Badge not found' });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const alreadyHas = user.badges?.some(b => b.name === badge.name);
    if (alreadyHas) return res.status(409).json({ message: 'User already has this badge' });

    user.badges = user.badges || [];
    user.badges.push({ name: badge.name, description: badge.description, icon: badge.icon || '', earnedAt: new Date() });
    await user.save();

    res.json({ message: `Badge "${badge.name}" granted to ${user.username}`, badges: user.badges });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE /api/admin/badges/:badgeId/revoke/:userId — revoke a badge from a user
router.delete('/badges/:badgeId/revoke/:userId', requireAdmin, async (req, res) => {
  try {
    const badge = await Badge.findById(req.params.badgeId).lean();
    if (!badge) return res.status(404).json({ message: 'Badge not found' });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const before = user.badges?.length || 0;
    user.badges = (user.badges || []).filter(b => b.name !== badge.name);
    if (user.badges.length === before) return res.status(404).json({ message: 'User does not have this badge' });

    await user.save();
    res.json({ message: `Badge "${badge.name}" revoked from ${user.username}`, badges: user.badges });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /api/admin/badges/sync-icons — backfill icon field on all user badge entries
router.post('/badges/sync-icons', requireAdmin, async (req, res) => {
  try {
    const badges = await Badge.find({}).lean();
    const iconMap = {};
    badges.forEach(b => { iconMap[b.name] = b.icon || ''; });

    const users = await User.find({ 'badges.0': { $exists: true } });
    let updated = 0;
    for (const user of users) {
      let changed = false;
      user.badges.forEach(b => {
        if (!b.icon && iconMap[b.name] !== undefined) {
          b.icon = iconMap[b.name];
          changed = true;
        }
      });
      if (changed) { await user.save(); updated++; }
    }
    res.json({ message: `Synced badge icons for ${updated} users` });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

/**
 * GET /api/admin/role-history/:userId
 * Fetch role change history for a specific user from the activity log
 */
router.get('/role-history/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const history = await ActivityLog.find({
      action: 'user_role_change',
      targetId: userId
    })
      .populate('userId', 'username displayName')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ history });
  } catch (error) {
    console.error('Error fetching role history:', error.message);
    res.status(500).json({ message: 'Failed to fetch role history' });
  }
});

/**
 * POST /api/admin/migrate
 * Migrate orphaned data (data without userId) to a specific user
 */
router.post('/migrate', requireAdmin, async (req, res) => {
  try {
    const { targetUserId } = req.body;

    // Default to current admin if no target specified
    const userId = targetUserId || req.user._id;

    // Verify target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        message: 'Target user not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const results = {
      cards: 0,
      decks: 0,
      locations: 0,
      tags: 0,
      wishlistItems: 0
    };

    // Get mongoose models (they're registered globally)
    const Card = mongoose.model('Card');
    const Deck = mongoose.model('Deck');
    const Location = mongoose.model('Location');
    const Tag = mongoose.model('Tag');
    const WishlistItem = mongoose.model('WishlistItem');

    // Migrate cards without userId
    const cardResult = await Card.updateMany(
      { userId: { $exists: false } },
      { $set: { userId } }
    );
    results.cards = cardResult.modifiedCount;

    // Also migrate cards with null userId
    const cardNullResult = await Card.updateMany(
      { userId: null },
      { $set: { userId } }
    );
    results.cards += cardNullResult.modifiedCount;

    // Migrate decks
    const deckResult = await Deck.updateMany(
      { $or: [{ userId: { $exists: false } }, { userId: null }] },
      { $set: { userId } }
    );
    results.decks = deckResult.modifiedCount;

    // Migrate locations
    const locationResult = await Location.updateMany(
      { $or: [{ userId: { $exists: false } }, { userId: null }] },
      { $set: { userId } }
    );
    results.locations = locationResult.modifiedCount;

    // Migrate tags
    const tagResult = await Tag.updateMany(
      { $or: [{ userId: { $exists: false } }, { userId: null }] },
      { $set: { userId } }
    );
    results.tags = tagResult.modifiedCount;

    // Migrate wishlist items
    const wishlistResult = await WishlistItem.updateMany(
      { $or: [{ userId: { $exists: false } }, { userId: null }] },
      { $set: { userId } }
    );
    results.wishlistItems = wishlistResult.modifiedCount;

    // Migrate player profiles
    const PlayerProfile = mongoose.model('PlayerProfile');
    const profileResult = await PlayerProfile.updateMany(
      { $or: [{ userId: { $exists: false } }, { userId: null }] },
      { $set: { userId } }
    );
    results.playerProfiles = profileResult.modifiedCount;

    // Migrate game sessions
    const GameSession = mongoose.model('GameSession');
    const gameResult = await GameSession.updateMany(
      { $or: [{ userId: { $exists: false } }, { userId: null }] },
      { $set: { userId } }
    );
    results.gameSessions = gameResult.modifiedCount;

    // Log the migration
    await logActivity({
      userId: req.user._id,
      action: 'data_migrate',
      category: 'admin',
      targetType: 'user',
      targetId: userId,
      targetName: targetUser.username,
      details: results,
      ipAddress: getClientIp(req)
    });

    res.json({
      message: 'Migration completed',
      targetUser: targetUser.username,
      migrated: results,
      total: Object.values(results).reduce((a, b) => a + b, 0)
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/admin/activity
 * Get system-wide activity log
 */
router.get('/activity', requireAdmin, async (req, res) => {
  try {
    const { limit = 100, skip = 0, category, action, userId } = req.query;

    const activityLog = await ActivityLog.getSystemActivity({
      limit: parseInt(limit),
      skip: parseInt(skip),
      category,
      action,
      userId
    });

    const total = await ActivityLog.countDocuments(
      userId ? { userId } : {}
    );

    res.json({
      activity: activityLog,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/admin/health
 * Get system health statistics
 */
router.get('/health', requireAdmin, async (req, res) => {
  try {
    const Card = mongoose.model('Card');
    const Deck = mongoose.model('Deck');

    // User stats
    const [
      totalUsers,
      activeUsers,
      adminCount,
      editorCount,
      viewerCount
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'admin', isActive: true }),
      User.countDocuments({ role: 'editor', isActive: true }),
      User.countDocuments({ role: 'viewer', isActive: true })
    ]);

    // Session stats
    const [
      totalSessions,
      activeSessions
    ] = await Promise.all([
      Session.countDocuments(),
      Session.countDocuments({ isValid: true, expiresAt: { $gt: new Date() } })
    ]);

    // Data stats
    const [
      totalCards,
      totalDecks,
      orphanedCards,
      orphanedDecks
    ] = await Promise.all([
      Card.countDocuments(),
      Deck.countDocuments(),
      Card.countDocuments({ $or: [{ userId: { $exists: false } }, { userId: null }] }),
      Deck.countDocuments({ $or: [{ userId: { $exists: false } }, { userId: null }] })
    ]);

    // Recent activity
    const recentLogins = await ActivityLog.countDocuments({
      action: 'login',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });

    // System settings
    const settings = await SystemSettings.getAll();

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        byRole: {
          admin: adminCount,
          editor: editorCount,
          viewer: viewerCount
        }
      },
      sessions: {
        total: totalSessions,
        active: activeSessions
      },
      data: {
        cards: totalCards,
        decks: totalDecks,
        orphaned: {
          cards: orphanedCards,
          decks: orphanedDecks
        }
      },
      activity: {
        loginsLast24h: recentLogins
      },
      settings,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get health error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/admin/settings
 * Get all system settings
 */
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await SystemSettings.getAll();
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/admin/settings/:key
 * Update a system setting
 */
router.put('/settings/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({
        message: 'Value is required',
        code: 'MISSING_VALUE'
      });
    }

    const setting = await SystemSettings.setValue(key, value, req.user._id);

    // Log the change
    await logActivity({
      userId: req.user._id,
      action: 'settings_update',
      category: 'admin',
      targetType: 'settings',
      targetName: key,
      details: { value },
      ipAddress: getClientIp(req)
    });

    res.json(setting);
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/admin/maintenance
 * Toggle maintenance mode
 */
router.post('/maintenance', requireAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        message: 'enabled (boolean) is required',
        code: 'MISSING_VALUE'
      });
    }

    await SystemSettings.setValue('maintenanceMode', enabled, req.user._id);

    // Log the change
    await logActivity({
      userId: req.user._id,
      action: 'maintenance_toggle',
      category: 'admin',
      details: { enabled },
      ipAddress: getClientIp(req)
    });

    res.json({
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      maintenanceMode: enabled
    });
  } catch (error) {
    console.error('Toggle maintenance error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/admin/init
 * Initialize system settings (run once on first admin login)
 */
router.post('/init', requireAdmin, async (req, res) => {
  try {
    await SystemSettings.initializeDefaults();

    res.json({
      message: 'System settings initialized',
      settings: await SystemSettings.getAll()
    });
  } catch (error) {
    console.error('Init settings error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Mute Management Endpoints
const Ban = require('../models/Ban');
const SpamFilterConfig = require('../models/SpamFilterConfig');
const { checkSpam } = require('../utils/spamFilter');

const MUTE_DURATIONS = {
  1: 3600000,    // 1 hour
  2: 86400000,   // 1 day
  3: 604800000,  // 1 week
  4: 2592000000, // 30 days
  5: null        // permanent
};

/**
 * POST /api/admin/mute/:userId - Create or escalate mute
 */
router.post('/mute/:userId', requireModerator(), async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, level, mutedUntil } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'reason is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Deactivate any existing active mute
    await Ban.updateMany(
      { userId, type: 'mute', isActive: true },
      { isActive: false }
    );

    // Determine mute level (1-5) and expiry
    const muteLevel = Math.min(Math.max(parseInt(level) || 1, 1), 5);
    let expiresAt = null;

    if (mutedUntil) {
      expiresAt = new Date(mutedUntil);
    } else {
      const durationMs = MUTE_DURATIONS[muteLevel];
      expiresAt = durationMs ? new Date(Date.now() + durationMs) : null;
    }

    const newMute = new Ban({
      userId,
      type: 'mute',
      reason,
      level: muteLevel,
      mutedUntil: expiresAt,
      isActive: true
    });

    await newMute.save();

    res.json({
      success: true,
      message: expiresAt
        ? `User muted until ${expiresAt.toISOString()}`
        : 'User permanently muted',
      ban: newMute
    });
  } catch (error) {
    console.error('Create mute error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/admin/unmute/:userId - Deactivate mute
 */
router.post('/unmute/:userId', requireModerator(), async (req, res) => {
  try {
    const result = await Ban.findOneAndUpdate(
      { userId: req.params.userId, type: 'mute', isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: 'No active mute found' });
    }

    res.json({ success: true, message: 'Mute removed', ban: result });
  } catch (error) {
    console.error('Unmute error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/admin/mute/:userId - Revoke mute (alias for backwards compatibility)
 */
router.delete('/mute/:userId', requireModerator(), async (req, res) => {
  try {
    const result = await Ban.findOneAndUpdate(
      { userId: req.params.userId, type: 'mute', isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: 'No active mute found' });
    }

    res.json({ success: true, message: 'Mute revoked', ban: result });
  } catch (error) {
    console.error('Revoke mute error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/admin/mutes - List active mutes (paginated)
 */
router.get('/mutes', requireModerator(), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const now = new Date();
    const query = {
      type: 'mute',
      isActive: true,
      $or: [
        { mutedUntil: { $gt: now } },
        { mutedUntil: null }
      ]
    };

    const [mutes, total] = await Promise.all([
      Ban.find(query)
        .populate('userId', 'username displayName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Ban.countDocuments(query)
    ]);

    res.json({
      mutes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List mutes error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/admin/mutes/:userId - Get mute details and history for a specific user
 */
router.get('/mutes/:userId', requireModerator(), async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('username displayName');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Active mute
    const now = new Date();
    const ban = await Ban.findOne({
      userId,
      type: 'mute',
      isActive: true,
      $or: [
        { mutedUntil: { $gt: now } },
        { mutedUntil: null }
      ]
    }).lean();

    // Full history (all mutes, active or not)
    const history = await Ban.find({ userId, type: 'mute' })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ user, ban, history });
  } catch (error) {
    console.error('Get user mute error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/admin/appeals - List pending ban/mute appeals (paginated)
 */
router.get('/appeals', requireModerator(), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      appealedAt: { $exists: true, $ne: null },
      appealStatus: 'pending'
    };

    const [appeals, total] = await Promise.all([
      Ban.find(query)
        .populate('userId', 'username displayName')
        .sort({ appealedAt: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Ban.countDocuments(query)
    ]);

    res.json({
      appeals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List appeals error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/admin/appeals/:banId/approve - Approve a ban/mute appeal
 */
router.post('/appeals/:banId/approve', requireModerator(), async (req, res) => {
  try {
    const { banId } = req.params;
    const { message } = req.body;

    const ban = await Ban.findById(banId);
    if (!ban) {
      return res.status(404).json({ message: 'Ban/mute record not found' });
    }

    if (!ban.appealedAt) {
      return res.status(400).json({ message: 'No appeal has been submitted for this record' });
    }

    if (ban.appealStatus !== 'pending') {
      return res.status(400).json({ message: `Appeal already ${ban.appealStatus}` });
    }

    ban.appealStatus = 'approved';
    ban.appealReviewedBy = req.user._id;
    ban.appealReviewedAt = new Date();
    ban.isActive = false; // Lift the ban/mute on approval

    await ban.save();

    res.json({
      success: true,
      message: message || 'Appeal approved. Ban/mute has been lifted.',
      ban
    });
  } catch (error) {
    console.error('Approve appeal error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/admin/appeals/:banId/reject - Reject a ban/mute appeal
 */
router.post('/appeals/:banId/reject', requireModerator(), async (req, res) => {
  try {
    const { banId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'reason is required when rejecting an appeal' });
    }

    const ban = await Ban.findById(banId);
    if (!ban) {
      return res.status(404).json({ message: 'Ban/mute record not found' });
    }

    if (!ban.appealedAt) {
      return res.status(400).json({ message: 'No appeal has been submitted for this record' });
    }

    if (ban.appealStatus !== 'pending') {
      return res.status(400).json({ message: `Appeal already ${ban.appealStatus}` });
    }

    ban.appealStatus = 'rejected';
    ban.appealReviewedBy = req.user._id;
    ban.appealReviewedAt = new Date();

    await ban.save();

    res.json({
      success: true,
      message: `Appeal rejected: ${reason}`,
      ban
    });
  } catch (error) {
    console.error('Reject appeal error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/admin/spam-config - Get spam filter config
 */
router.get('/spam-config', requireModerator(), async (req, res) => {
  try {
    const config = await SpamFilterConfig.getConfig();
    res.json(config);
  } catch (error) {
    console.error('Get spam config error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/admin/spam-config - Update spam config
 */
router.put('/spam-config', requireModerator(), async (req, res) => {
  try {
    const { sensitivity, bannedWords, minReputationToAutoFlag, maxPostsPerHourPerUser } = req.body;

    const config = await SpamFilterConfig.getConfig();
    if (sensitivity) config.sensitivity = sensitivity;
    if (bannedWords) config.bannedWords = bannedWords;
    if (minReputationToAutoFlag !== undefined) config.minReputationToAutoFlag = minReputationToAutoFlag;
    if (maxPostsPerHourPerUser !== undefined) config.maxPostsPerHourPerUser = maxPostsPerHourPerUser;

    await config.save();
    res.json(config);
  } catch (error) {
    console.error('Update spam config error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/admin/spam-config/test - Test spam filter
 */
router.post('/spam-config/test', requireModerator(), async (req, res) => {
  try {
    const { text } = req.body;
    const user = await User.findById(req.user._id);

    const { flagged, reasons } = await checkSpam(
      req.user._id,
      text,
      user.reputation || 0
    );

    res.json({ flagged, reasons });
  } catch (error) {
    console.error('Test spam filter error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/admin/modmail - Send modmail to all users
 */
router.post('/modmail', requireModerator(), async (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ message: 'Subject and message are required' });
    }

    // Get or create modmail user
    let modmailUser = await User.findOne({ username: 'modmail' });
    if (!modmailUser) {
      modmailUser = await User.create({
        username: 'modmail',
        email: 'modmail@system.local',
        displayName: 'Modmail',
        passwordHash: 'system-account',
        role: 'admin',
        isActive: true
      });
    }

    // Get all active users
    const users = await User.find({ isActive: true, _id: { $ne: modmailUser._id } }).select('_id');

    let notificationCount = 0;
    let dmCount = 0;

    // Create notifications and DMs for each user
    for (const user of users) {
      try {
        // Create notification
        const Notification = mongoose.model('Notification');
        await Notification.create({
          userId: user._id,
          type: 'dm',
          fromUserId: modmailUser._id,
          messageId: null,
          content: message.substring(0, 200),
          isRead: false
        });
        notificationCount++;

        // Create DM
        const DirectMessage = mongoose.model('DirectMessage');
        await DirectMessage.create({
          fromUserId: modmailUser._id,
          toUserId: user._id,
          content: `**[${subject}]**\n\n${message}`,
          isRead: false
        });
        dmCount++;
      } catch (err) {
        console.error(`Error sending modmail to user ${user._id}:`, err);
      }
    }

    res.json({
      success: true,
      message: 'Modmail sent',
      notificationCount,
      dmCount,
      totalUsers: users.length
    });
  } catch (error) {
    console.error('Send modmail error:', error);
    res.status(500).json({ message: error.message });
  }
});

// ==================== ACCOUNT BAN MANAGEMENT ====================

/**
 * POST /api/admin/account-bans - Create account ban or suspension
 */
router.post('/account-bans', requireModerator(), async (req, res) => {
  try {
    const { userId, banType, reason, expiresAt } = req.body;
    if (!userId || !banType || !reason) {
      return res.status(400).json({ message: 'userId, banType, and reason are required' });
    }
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }
    if (banType === 'suspension' && !expiresAt) {
      return res.status(400).json({ message: 'expiresAt is required for suspension bans' });
    }

    // Deactivate any existing active ban for this user
    await UserBan.updateMany({ userId, isActive: true }, { isActive: false });

    const ban = new UserBan({
      userId,
      banType,
      reason,
      bannedBy: req.user._id,
      expiresAt: banType === 'suspension' ? new Date(expiresAt) : null,
      isActive: true
    });
    await ban.save();

    await ModerationHistory.create({
      userId,
      actionType: banType === 'suspension' ? 'suspend' : 'ban',
      actionDetails: { banId: ban._id, reason, expiresAt },
      performedBy: req.user._id
    });

    res.status(201).json({ message: 'Ban created', ban });
  } catch (error) {
    console.error('Create ban error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/admin/account-bans - List active bans with optional filters
 */
router.get('/account-bans', requireModerator(), async (req, res) => {
  try {
    const { userId, banType, active = 'true', page = 1, limit = 50 } = req.query;
    const query = {};
    if (userId) query.userId = userId;
    if (banType) query.banType = banType;
    if (active !== 'all') query.isActive = active === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [bans, total] = await Promise.all([
      UserBan.find(query)
        .populate('userId', 'username email')
        .populate('bannedBy', 'username')
        .sort({ bannedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      UserBan.countDocuments(query)
    ]);

    res.json({ bans, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('List bans error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PUT /api/admin/account-bans/:id - Update ban expiration or reason
 */
router.put('/account-bans/:id', requireModerator(), async (req, res) => {
  try {
    const { reason, expiresAt } = req.body;
    const ban = await UserBan.findById(req.params.id);
    if (!ban) return res.status(404).json({ message: 'Ban not found' });

    if (!ban.isActive) return res.status(409).json({ message: 'Cannot modify an inactive ban' });

    if (reason) ban.reason = reason;
    if (expiresAt !== undefined) ban.expiresAt = expiresAt ? new Date(expiresAt) : null;
    await ban.save();

    await ModerationHistory.create({
      userId: ban.userId,
      actionType: 'override',
      actionDetails: { banId: ban._id, reason: ban.reason, expiresAt: ban.expiresAt },
      performedBy: req.user._id
    });

    res.json({ message: 'Ban updated', ban });
  } catch (error) {
    console.error('Update ban error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * DELETE /api/admin/account-bans/:id - Revoke (deactivate) a ban
 */
router.delete('/account-bans/:id', requireModerator(), async (req, res) => {
  try {
    const ban = await UserBan.findById(req.params.id);
    if (!ban) return res.status(404).json({ message: 'Ban not found' });

    ban.isActive = false;
    await ban.save();

    await ModerationHistory.create({
      userId: ban.userId,
      actionType: 'ban_revoked',
      actionDetails: { banId: ban._id, revokedBy: req.user._id },
      performedBy: req.user._id
    });

    res.json({ message: 'Ban revoked' });
  } catch (error) {
    console.error('Revoke ban error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== WARNING MANAGEMENT ====================

/**
 * POST /api/admin/warnings - Issue a warning to a user
 * Auto-escalates to 7-day suspension if user has 3+ warnings in 90 days
 */
router.post('/warnings', requireModerator(), async (req, res) => {
  try {
    const { userId, reason, bypassEscalation = false } = req.body;
    if (!userId || !reason) {
      return res.status(400).json({ message: 'userId and reason are required' });
    }
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    // Count recent warnings (90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const recentWarnings = await UserWarning.countDocuments({
      userId,
      warnedAt: { $gte: ninetyDaysAgo }
    });

    const escalationLevel = Math.min(recentWarnings + 1, 3);

    const warning = new UserWarning({
      userId,
      reason,
      warnedBy: req.user._id,
      escalationLevel
    });
    await warning.save();

    await ModerationHistory.create({
      userId,
      actionType: 'warn',
      actionDetails: { warningId: warning._id, reason, escalationLevel },
      performedBy: req.user._id
    });

    if (bypassEscalation && escalationLevel >= 3) {
      await ModerationHistory.create({
        userId,
        actionType: 'override',
        actionDetails: { warningId: warning._id, reason: 'escalation bypass by admin', escalationLevel },
        performedBy: req.user._id
      });
    }

    let autoSuspension = null;

    // Auto-escalate to 7-day suspension at level 3
    if (escalationLevel >= 3 && !bypassEscalation) {
      await UserBan.updateMany({ userId, isActive: true }, { isActive: false });
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      autoSuspension = new UserBan({
        userId,
        banType: 'suspension',
        reason: 'Auto-escalated: 3 warnings in 90 days',
        bannedBy: req.user._id,
        expiresAt,
        isActive: true
      });
      await autoSuspension.save();

      await ModerationHistory.create({
        userId,
        actionType: 'suspend',
        actionDetails: { banId: autoSuspension._id, reason: 'auto-escalation', warningId: warning._id },
        performedBy: req.user._id
      });
    }

    res.status(201).json({
      message: autoSuspension ? 'Warning issued and auto-suspension applied' : 'Warning issued',
      warning,
      autoSuspension,
      escalationLevel
    });
  } catch (error) {
    console.error('Issue warning error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/admin/warnings/:userId - List warnings for a specific user
 */
router.get('/warnings/:userId', requireModerator(), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }
    const warnings = await UserWarning.find({ userId: req.params.userId })
      .populate('warnedBy', 'username')
      .sort({ warnedAt: -1 });

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const recentCount = warnings.filter(w => w.warnedAt >= ninetyDaysAgo).length;

    res.json({ warnings, recentCount, currentEscalationLevel: Math.min(recentCount, 3) });
  } catch (error) {
    console.error('List warnings error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== BAN APPEAL MANAGEMENT ====================

/**
 * GET /api/admin/ban-appeals - List pending appeals (admin view)
 */
router.get('/ban-appeals', requireModerator(), async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 50 } = req.query;
    const query = {};
    if (status !== 'all') query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [appeals, total] = await Promise.all([
      BanAppeal.find(query)
        .populate('userId', 'username email')
        .populate('banId')
        .populate('reviewedBy', 'username')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      BanAppeal.countDocuments(query)
    ]);

    res.json({ appeals, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('List appeals error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PUT /api/admin/ban-appeals/:id - Approve or deny an appeal
 */
router.put('/ban-appeals/:id', requireModerator(), async (req, res) => {
  try {
    const { status, decisionReason } = req.body;
    if (!['approved', 'denied'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved or denied' });
    }
    if (!decisionReason) {
      return res.status(400).json({ message: 'decisionReason is required' });
    }

    const appeal = await BanAppeal.findById(req.params.id);
    if (!appeal) return res.status(404).json({ message: 'Appeal not found' });
    if (appeal.status !== 'pending') return res.status(409).json({ message: 'Appeal has already been reviewed' });

    appeal.status = status;
    appeal.reviewedBy = req.user._id;
    appeal.reviewedAt = new Date();
    appeal.decisionReason = decisionReason;
    await appeal.save();

    if (status === 'approved') {
      const associatedBan = await UserBan.findById(appeal.banId);
      if (associatedBan) {
        associatedBan.isActive = false;
        await associatedBan.save();
      }
      await ModerationHistory.create({
        userId: appeal.userId,
        actionType: 'appeal_approved',
        actionDetails: { appealId: appeal._id, banId: appeal.banId, decisionReason },
        performedBy: req.user._id
      });
    } else {
      await ModerationHistory.create({
        userId: appeal.userId,
        actionType: 'appeal_denied',
        actionDetails: { appealId: appeal._id, decisionReason },
        performedBy: req.user._id
      });
    }

    res.json({ message: `Appeal ${status}`, appeal });
  } catch (error) {
    console.error('Review appeal error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/admin/moderation-history/:userId - Full moderation audit trail for a user
 */
router.get('/moderation-history/:userId', requireModerator(), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }
    const history = await ModerationHistory.find({ userId: req.params.userId })
      .populate('performedBy', 'username')
      .sort({ createdAt: -1 });

    res.json({ history });
  } catch (error) {
    console.error('Moderation history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== PRICING ADMIN ====================

// In-memory job store (simple; resets on server restart)
const priceUpdateJobs = {};

/**
 * Helper: fetch price from Exor Games with Scryfall fallback.
 * Mirrors the getPriceWithFallback function in server.js (no import to avoid circular deps).
 */
async function fetchPriceForCard(cardName, isFoil = false) {
  // Try Exor Games first
  try {
    const searchUrl = `https://exorgames.com/a/search?type=product&q=${encodeURIComponent(cardName)}`;
    const response = await axios.get(searchUrl);
    const html = response.data;

    const priceMatch = html.match(/"price":\s*(\d+)/);
    if (priceMatch) {
      const priceInCents = parseInt(priceMatch[1]);
      const priceCAD = priceInCents / 100;
      const priceUSD = Math.round(priceCAD * 0.73 * 100) / 100;

      if (priceUSD > 0) {
        return { cad: priceCAD, usd: priceUSD, source: 'Exor Games' };
      }
    }
  } catch (error) {
    console.error('Exor Games price fetch failed:', error.message);
  }

  // Fallback to Scryfall
  try {
    console.log('Admin price fetch: falling back to Scryfall for:', cardName);
    const response = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
    const scryfallPrice = isFoil
      ? (response.data.prices.usd_foil ? parseFloat(response.data.prices.usd_foil) : 0)
      : (response.data.prices.usd ? parseFloat(response.data.prices.usd) : 0);

    if (scryfallPrice > 0) {
      return { cad: 0, usd: scryfallPrice, source: 'Scryfall (backup)' };
    }
  } catch (error) {
    console.error('Scryfall price fetch failed:', error.message);
  }

  return { cad: 0, usd: 0, source: 'None (not found)' };
}

/**
 * POST /api/admin/force-price-update - Start async background price update job
 */
router.post('/force-price-update', requireContentManager(), async (req, res) => {
  try {
    const jobId = `price_update_${Date.now()}`;
    priceUpdateJobs[jobId] = {
      status: 'running',
      startedAt: new Date(),
      total: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };

    res.json({ jobId, message: 'Price update job started' });

    // Capture adminId before IIFE (req not available inside async background)
    const adminId = req.user._id;

    // Run async in background (don't await)
    (async () => {
      try {
        const Card = mongoose.model('Card');
        const cards = await Card.find({});
        priceUpdateJobs[jobId].total = cards.length;

        for (const card of cards) {
          try {
            // Rate limit: 500ms between requests
            await new Promise(resolve => setTimeout(resolve, 500));

            const priceData = await fetchPriceForCard(card.name, card.isFoil);

            if (priceData && (priceData.usd > 0 || priceData.source !== 'None (not found)')) {
              await Card.findByIdAndUpdate(card._id, {
                price: priceData.usd,
                updatedAt: new Date()
              });
              priceUpdateJobs[jobId].updated++;
            } else {
              priceUpdateJobs[jobId].skipped++;
            }
          } catch (cardErr) {
            priceUpdateJobs[jobId].failed++;
            priceUpdateJobs[jobId].errors.push({ card: card.name, error: cardErr.message });
          }
        }

        priceUpdateJobs[jobId].status = 'complete';
        priceUpdateJobs[jobId].completedAt = new Date();

        try {
          await ModerationHistory.create({
            userId: adminId,
            actionType: 'price_update',
            actionDetails: {
              jobId,
              total: priceUpdateJobs[jobId].total,
              updated: priceUpdateJobs[jobId].updated,
              skipped: priceUpdateJobs[jobId].skipped,
              failed: priceUpdateJobs[jobId].failed
            },
            performedBy: adminId
          });
        } catch (logErr) {
          console.error('Failed to log price update to ModerationHistory:', logErr);
        }
      } catch (err) {
        priceUpdateJobs[jobId].status = 'failed';
        priceUpdateJobs[jobId].error = err.message;
      }
    })();
  } catch (error) {
    console.error('Force price update error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/admin/force-price-update/:jobId - Poll job status
 */
router.get('/force-price-update/:jobId', requireContentManager(), async (req, res) => {
  const job = priceUpdateJobs[req.params.jobId];
  if (!job) return res.status(404).json({ message: 'Job not found' });
  res.json({ jobId: req.params.jobId, ...job });
});

// ==================== COLLECTION AUDITS ====================

/**
 * POST /api/admin/audits/run - Start async collection audit scan
 */
router.post('/audits/run', requireContentManager(), async (req, res) => {
  try {
    const { auditName = `Audit ${new Date().toLocaleDateString()}` } = req.body;

    const audit = new CollectionAudit({
      auditName,
      status: 'running',
      createdBy: req.user._id
    });
    await audit.save();

    res.status(201).json({ message: 'Audit started', auditId: audit._id });

    // Run async in background
    (async () => {
      try {
        const Card = mongoose.model('Card');
        const cards = await Card.find({});
        const issues = [];

        for (const card of cards) {
          // Check for missing price
          if (!card.price || card.price === 0) {
            issues.push({
              cardId: card._id,
              userId: card.userId,
              cardName: card.name,
              setName: card.set || 'Unknown',
              issueType: 'missing_price',
              issueValue: '0',
              flagged: false,
              resolved: false
            });
          }
          // Check for missing set
          if (!card.set || card.set === 'Unknown') {
            issues.push({
              cardId: card._id,
              userId: card.userId,
              cardName: card.name,
              setName: card.set || 'Unknown',
              issueType: 'missing_set',
              issueValue: card.set || 'none',
              flagged: false,
              resolved: false
            });
          }
          // Check for missing Scryfall ID
          if (!card.scryfallId) {
            issues.push({
              cardId: card._id,
              userId: card.userId,
              cardName: card.name,
              setName: card.set || 'Unknown',
              issueType: 'missing_scryfall_id',
              issueValue: 'none',
              flagged: false,
              resolved: false
            });
          }
          // Check for invalid quantity
          if (!card.quantity || card.quantity < 1) {
            issues.push({
              cardId: card._id,
              userId: card.userId,
              cardName: card.name,
              setName: card.set || 'Unknown',
              issueType: 'invalid_quantity',
              issueValue: String(card.quantity || 0),
              flagged: false,
              resolved: false
            });
          }
        }

        await CollectionAudit.findByIdAndUpdate(audit._id, {
          status: 'complete',
          completedAt: new Date(),
          issues
        });
      } catch (err) {
        console.error('Audit background error:', err);
        await CollectionAudit.findByIdAndUpdate(audit._id, {
          status: 'failed',
          completedAt: new Date()
        });
      }
    })();
  } catch (error) {
    console.error('Start audit error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/admin/audits - List all audits
 */
router.get('/audits', requireContentManager(), async (req, res) => {
  try {
    const audits = await CollectionAudit.find()
      .populate('createdBy', 'username')
      .sort({ ranAt: -1 })
      .select('-issues'); // Exclude issues array for list view (can be large)

    res.json({ audits });
  } catch (error) {
    console.error('List audits error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/admin/audits/:id - Fetch audit results including issues
 */
router.get('/audits/:id', requireContentManager(), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid audit ID' });
    }
    const audit = await CollectionAudit.findById(req.params.id).populate('createdBy', 'username');
    if (!audit) return res.status(404).json({ message: 'Audit not found' });

    res.json({ audit });
  } catch (error) {
    console.error('Get audit error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * PUT /api/admin/audits/:id/action - Resolve/flag/delete an issue
 */
router.put('/audits/:id/action', requireContentManager(), async (req, res) => {
  try {
    const { issueIndex, action } = req.body; // action: 'resolve', 'flag', 'delete'
    if (!['resolve', 'flag', 'delete'].includes(action)) {
      return res.status(400).json({ message: 'action must be resolve, flag, or delete' });
    }

    const audit = await CollectionAudit.findById(req.params.id);
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    if (issueIndex === undefined || issueIndex < 0 || issueIndex >= audit.issues.length) {
      return res.status(400).json({ message: 'Invalid issueIndex' });
    }

    if (action === 'delete') {
      audit.issues.splice(issueIndex, 1);
    } else if (action === 'resolve') {
      audit.issues[issueIndex].resolved = true;
    } else if (action === 'flag') {
      audit.issues[issueIndex].flagged = !audit.issues[issueIndex].flagged; // toggle
    }

    await audit.save();
    res.json({ message: `Issue ${action}d`, audit });
  } catch (error) {
    console.error('Audit action error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== DATA MANAGEMENT ====================

// In-memory backup store
const backups = {};

/**
 * POST /api/admin/backup - Create in-memory backup of all cards
 */
router.post('/backup', requireAdmin, async (req, res) => {
  try {
    const Card = mongoose.model('Card');

    const [cards, users] = await Promise.all([
      Card.find({}).lean(),
      User.find({}).select('-password -passwordHash').lean()
    ]);

    const backupId = `backup_${Date.now()}`;
    const backup = {
      id: backupId,
      createdAt: new Date(),
      createdBy: req.user._id,
      cardCount: cards.length,
      userCount: users.length,
      data: { cards, users }
    };
    backups[backupId] = backup;

    res.json({
      backupId,
      createdAt: backup.createdAt,
      cardCount: backup.cardCount,
      userCount: backup.userCount,
      message: 'Backup created (in-memory, lost on server restart)'
    });
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/admin/backup/:id/download - Download a backup as JSON
 */
router.get('/backup/:id/download', requireAdmin, async (req, res) => {
  const backup = backups[req.params.id];
  if (!backup) return res.status(404).json({ message: 'Backup not found (may have expired on restart)' });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="mtg-backup-${req.params.id}.json"`);
  res.send(JSON.stringify(backup.data, null, 2));
});

/**
 * POST /api/admin/restore - Restore cards from a backup (replaces all cards)
 * Body: { backupId } or { data: { cards: [...] } }
 */
router.post('/restore', requireAdmin, async (req, res) => {
  try {
    const { backupId, data, confirm } = req.body;

    if (confirm !== 'RESTORE') {
      return res.status(400).json({
        message: 'Restoration requires confirm: "RESTORE" in request body. This action will permanently delete all current cards.'
      });
    }

    let restoreData;
    if (backupId) {
      const backup = backups[backupId];
      if (!backup) return res.status(404).json({ message: 'Backup not found' });
      restoreData = backup.data;
    } else if (data && data.cards) {
      restoreData = data;
    } else {
      return res.status(400).json({ message: 'backupId or data.cards required' });
    }

    if (!Array.isArray(restoreData.cards)) {
      return res.status(400).json({ message: 'restoreData.cards must be an array' });
    }

    const Card = mongoose.model('Card');
    await Card.deleteMany({});
    await Card.insertMany(restoreData.cards);

    res.json({ message: `Restored ${restoreData.cards.length} cards` });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/admin/export - Export data as JSON (cards, users, activity, moderation)
 */
router.post('/export', requireAdmin, async (req, res) => {
  try {
    const { type = 'cards' } = req.body;

    const Card = mongoose.model('Card');

    let exportData;
    let filename;

    switch (type) {
      case 'cards':
        exportData = await Card.find({}).lean();
        filename = 'cards-export.json';
        break;
      case 'users':
        exportData = await User.find({}).select('-password -passwordHash').lean();
        filename = 'users-export.json';
        break;
      case 'activity':
        exportData = await ActivityLog.find({}).sort({ createdAt: -1 }).lean();
        filename = 'activity-export.json';
        break;
      case 'moderation':
        exportData = await ModerationHistory.find({}).populate('userId', 'username').populate('performedBy', 'username').lean();
        filename = 'moderation-export.json';
        break;
      default:
        return res.status(400).json({ message: 'type must be cards, users, activity, or moderation' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * POST /api/admin/cleanup - Delete orphaned/expired data and archive old logs
 */
router.post('/cleanup', requireAdmin, async (req, res) => {
  try {
    const { daysToKeep = 90, preview = false } = req.body;
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    // Count items to clean
    const [oldLogs, expiredSessions, expiredBans] = await Promise.all([
      ActivityLog.countDocuments({ createdAt: { $lt: cutoff } }),
      Session.countDocuments({ expiresAt: { $lt: new Date() } }),
      UserBan.countDocuments({ isActive: false, updatedAt: { $lt: cutoff } })
    ]);

    if (preview) {
      return res.json({
        preview: true,
        items: {
          oldActivityLogs: oldLogs,
          expiredSessions,
          inactiveBans: expiredBans
        }
      });
    }

    // Execute cleanup
    const [logsDeleted, sessionsDeleted, bansDeleted] = await Promise.all([
      ActivityLog.deleteMany({ createdAt: { $lt: cutoff } }),
      Session.deleteMany({ expiresAt: { $lt: new Date() } }),
      UserBan.deleteMany({ isActive: false, updatedAt: { $lt: cutoff } })
    ]);

    res.json({
      message: 'Cleanup complete',
      deleted: {
        activityLogs: logsDeleted.deletedCount,
        sessions: sessionsDeleted.deletedCount,
        inactiveBans: bansDeleted.deletedCount
      }
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/admin/forum-content - list hidden/flagged forum content
router.get('/forum-content', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const [hiddenPosts, hiddenThreads] = await Promise.all([
      ForumPost.find({ isHidden: true })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('authorId', 'username displayName')
        .populate('threadId', 'title')
        .lean(),
      ForumThread.find({ isHidden: true })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('authorId', 'username displayName')
        .lean()
    ]);

    const items = [
      ...hiddenPosts.map(p => ({
        _id: p._id,
        type: 'post',
        content: p.body,
        author: p.authorId,
        thread: p.threadId,
        createdAt: p.createdAt,
        flagReason: p.flagReason || null,
        flaggedAt: p.flaggedAt || p.updatedAt,
      })),
      ...hiddenThreads.map(t => ({
        _id: t._id,
        type: 'thread',
        content: t.content,
        title: t.title,
        author: t.authorId,
        createdAt: t.createdAt,
        flagReason: t.flagReason || null,
        flaggedAt: t.flaggedAt || t.updatedAt,
      }))
    ].sort((a, b) => new Date(b.flaggedAt) - new Date(a.flaggedAt));

    res.json({ items, total: items.length });
  } catch (error) {
    console.error('Forum content moderation error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/admin/forum-posts/:id - hard-delete a forum post
router.delete('/forum-posts/:id', requireAdmin, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    await ForumPost.findByIdAndDelete(req.params.id);

    await ForumThread.findByIdAndUpdate(post.threadId, {
      $inc: { postCount: -1 }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete post error:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/admin/forum-threads/:id - hard-delete a thread and all its posts
router.delete('/forum-threads/:id', requireAdmin, async (req, res) => {
  try {
    const thread = await ForumThread.findById(req.params.id);
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    await ForumPost.deleteMany({ threadId: req.params.id });
    await ForumThread.findByIdAndDelete(req.params.id);

    await ForumCategory.findByIdAndUpdate(thread.categoryId, {
      $inc: { threadCount: -1 }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete thread error:', error);
    res.status(500).json({ message: error.message });
  }
});

// GET /api/admin/performance - MongoDB slow query analysis and index recommendations
router.get('/performance', requireAdmin, async (req, res) => {
  try {
    const db = mongoose.connection.db;

    // Enable profiling for slow queries (>100ms) if not already enabled
    await db.command({ profile: 1, slowms: 100 });

    // Read recent slow queries (last 50)
    const profiles = await db.collection('system.profile')
      .find({})
      .sort({ ts: -1 })
      .limit(50)
      .toArray();

    // Summarize queries
    const queries = profiles.map(p => ({
      ts: p.ts,
      op: p.op,
      ns: p.ns,
      millis: p.millis,
      docsExamined: p.docsExamined || 0,
      docsReturned: p.nreturned || 0,
      keysExamined: p.keysExamined || 0,
      planSummary: p.planSummary || '',
      query: p.command?.filter || p.query || {},
    }));

    // Generate index recommendations
    // A query doing a COLLSCAN (collection scan) with many docs examined is a candidate
    const recommendations = [];
    const seen = new Set();
    for (const p of profiles) {
      if (p.planSummary && p.planSummary.includes('COLLSCAN') && p.docsExamined > 100) {
        const filter = p.command?.filter || p.query || {};
        const fields = Object.keys(filter).filter(k => k !== '$and' && k !== '$or');
        if (fields.length > 0) {
          const key = `${p.ns}:${fields.sort().join(',')}`;
          if (!seen.has(key)) {
            seen.add(key);
            recommendations.push({
              collection: p.ns,
              fields,
              reason: `COLLSCAN with ${p.docsExamined} docs examined`,
              suggestion: `db.${p.ns.split('.').pop()}.createIndex({ ${fields.map(f => `${f}: 1`).join(', ')} })`,
            });
          }
        }
      }
    }

    // Get current indexes for all collections
    const collections = await db.listCollections().toArray();
    const indexes = {};
    for (const col of collections) {
      try {
        indexes[col.name] = await db.collection(col.name).indexes();
      } catch {}
    }

    res.json({ queries, recommendations, indexes });
  } catch (error) {
    console.error('Admin performance error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
