const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../models/User');
const Session = require('../models/Session');
const ActivityLog = require('../models/ActivityLog');
const SystemSettings = require('../models/SystemSettings');
const UserBan = require('../models/UserBan');
const UserWarning = require('../models/UserWarning');
const BanAppeal = require('../models/BanAppeal');
const ModerationHistory = require('../models/ModerationHistory');
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
router.post('/mute/:userId', async (req, res) => {
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
router.post('/unmute/:userId', async (req, res) => {
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
router.delete('/mute/:userId', async (req, res) => {
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
router.get('/mutes', async (req, res) => {
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
router.get('/mutes/:userId', async (req, res) => {
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
router.get('/appeals', async (req, res) => {
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
router.post('/appeals/:banId/approve', async (req, res) => {
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
router.post('/appeals/:banId/reject', async (req, res) => {
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
router.get('/spam-config', async (req, res) => {
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
router.put('/spam-config', async (req, res) => {
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
router.post('/spam-config/test', async (req, res) => {
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
router.post('/modmail', verifyToken, requireAuth, requireAdmin, async (req, res) => {
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
router.post('/account-bans', async (req, res) => {
  try {
    const { userId, banType, reason, expiresAt } = req.body;
    if (!userId || !banType || !reason) {
      return res.status(400).json({ message: 'userId, banType, and reason are required' });
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
router.get('/account-bans', async (req, res) => {
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
router.put('/account-bans/:id', async (req, res) => {
  try {
    const { reason, expiresAt } = req.body;
    const ban = await UserBan.findById(req.params.id);
    if (!ban) return res.status(404).json({ message: 'Ban not found' });

    if (reason) ban.reason = reason;
    if (expiresAt !== undefined) ban.expiresAt = expiresAt ? new Date(expiresAt) : null;
    await ban.save();

    res.json({ message: 'Ban updated', ban });
  } catch (error) {
    console.error('Update ban error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * DELETE /api/admin/account-bans/:id - Revoke (deactivate) a ban
 */
router.delete('/account-bans/:id', async (req, res) => {
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
router.post('/warnings', async (req, res) => {
  try {
    const { userId, reason, bypassEscalation = false } = req.body;
    if (!userId || !reason) {
      return res.status(400).json({ message: 'userId and reason are required' });
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
router.get('/warnings/:userId', async (req, res) => {
  try {
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
 * POST /api/admin/ban-appeals - Submit a ban appeal (user-facing, requires auth)
 */
router.post('/ban-appeals', async (req, res) => {
  try {
    const { banId, appealText } = req.body;
    if (!banId || !appealText) {
      return res.status(400).json({ message: 'banId and appealText are required' });
    }

    const ban = await UserBan.findOne({ _id: banId, userId: req.user._id, isActive: true });
    if (!ban) return res.status(404).json({ message: 'Active ban not found for your account' });

    const existing = await BanAppeal.findOne({ userId: req.user._id, banId });
    if (existing) return res.status(409).json({ message: 'You have already submitted an appeal for this ban' });

    const appeal = new BanAppeal({
      userId: req.user._id,
      banId,
      appealText
    });
    await appeal.save();

    res.status(201).json({ message: 'Appeal submitted', appeal });
  } catch (error) {
    console.error('Submit appeal error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * GET /api/admin/ban-appeals - List pending appeals (admin view)
 */
router.get('/ban-appeals', async (req, res) => {
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
router.put('/ban-appeals/:id', async (req, res) => {
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
      await UserBan.findByIdAndUpdate(appeal.banId, { isActive: false });
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
router.get('/moderation-history/:userId', async (req, res) => {
  try {
    const history = await ModerationHistory.find({ userId: req.params.userId })
      .populate('performedBy', 'username')
      .sort({ createdAt: -1 });

    res.json({ history });
  } catch (error) {
    console.error('Moderation history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
