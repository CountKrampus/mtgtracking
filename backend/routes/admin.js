const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../models/User');
const Session = require('../models/Session');
const ActivityLog = require('../models/ActivityLog');
const SystemSettings = require('../models/SystemSettings');
const { verifyToken, requireAuth, requireAdmin, isMultiUserEnabled } = require('../middleware/auth');
const { logActivity, getClientIp } = require('../middleware/activityLogger');

// All admin routes require authentication and admin role
router.use(verifyToken);
router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * List all users
 */
router.get('/users', async (req, res) => {
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
router.get('/users/:id', async (req, res) => {
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
router.put('/users/:id', async (req, res) => {
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
      changes.oldRole = user.role;
      changes.newRole = role;
      user.role = role;

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
router.delete('/users/:id', async (req, res) => {
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
 * POST /api/admin/migrate
 * Migrate orphaned data (data without userId) to a specific user
 */
router.post('/migrate', async (req, res) => {
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
router.get('/activity', async (req, res) => {
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
router.get('/health', async (req, res) => {
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
router.get('/settings', async (req, res) => {
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
router.put('/settings/:key', async (req, res) => {
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
router.post('/maintenance', async (req, res) => {
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
router.post('/init', async (req, res) => {
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

module.exports = router;
