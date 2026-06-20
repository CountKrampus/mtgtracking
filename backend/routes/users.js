const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const User = require('../models/User');
const Session = require('../models/Session');
const ActivityLog = require('../models/ActivityLog');
const BanAppeal = require('../models/BanAppeal');
const UserBan = require('../models/UserBan');
const ForumLevel = require('../models/ForumLevel');
const Cosmetic = require('../models/Cosmetic');
const { hashPassword, verifyPassword, validatePasswordStrength } = require('../utils/passwords');
const { verifyToken, requireAuth, isMultiUserEnabled } = require('../middleware/auth');
const { logActivity, getClientIp } = require('../middleware/activityLogger');

const AVATAR_DIR = path.join(__dirname, '../user-avatars');

// All user routes require authentication
router.use(verifyToken);
router.use(requireAuth);

/**
 * GET /api/users/me
 * Get current user's profile
 */
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json(user.toSafeObject());
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/users/me
 * Update current user's profile
 */
router.put('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const { displayName, email, privacy, avatarUrl } = req.body;

    // Update display name if provided
    if (displayName !== undefined) {
      user.displayName = displayName.trim();
    }

    // Update email if provided (with validation)
    if (email && email !== user.email) {
      const normalizedEmail = email.toLowerCase().trim();

      // Check if email is already taken
      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id }
      });

      if (existingUser) {
        return res.status(400).json({
          message: 'Email is already in use',
          code: 'EMAIL_EXISTS'
        });
      }

      user.email = normalizedEmail;
    }

    // Update avatarUrl if provided (for preset avatars)
    if (avatarUrl !== undefined) {
      if (avatarUrl === '' || avatarUrl.startsWith('preset:')) {
        user.avatarUrl = avatarUrl;
      } else {
        return res.status(400).json({
          message: 'Invalid avatarUrl. Must be empty string or start with "preset:"'
        });
      }
    }

    // Update privacy sub-fields if provided (merge, don't replace)
    if (privacy && typeof privacy === 'object') {
      const allowed = ['isPublic', 'showCollection', 'showDecks', 'showWishlist', 'showForum', 'bio'];
      for (const key of allowed) {
        if (key in privacy) {
          user.privacy[key] = privacy[key];
        }
      }
    }

    await user.save();

    res.json(user.toSafeObject());
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/users/me/password
 * Change current user's password
 */
router.put('/me/password', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Current password and new password are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        message: 'Current password is incorrect',
        code: 'INVALID_PASSWORD'
      });
    }

    // Validate new password
    const passwordValidation = validatePasswordStrength(newPassword);

    if (!passwordValidation.isValid) {
      return res.status(400).json({
        message: 'New password does not meet requirements',
        code: 'WEAK_PASSWORD',
        errors: passwordValidation.errors
      });
    }

    // Hash and save new password
    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    // Invalidate all other sessions (security measure)
    const currentRefreshToken = req.body.keepCurrentSession ? null : undefined;
    if (req.body.logoutOtherSessions !== false) {
      await Session.invalidateAllForUser(user._id);
    }

    // Log activity
    await logActivity({
      userId: user._id,
      action: 'password_change',
      category: 'auth',
      ipAddress: getClientIp(req)
    });

    res.json({
      message: 'Password changed successfully',
      loggedOutOtherSessions: req.body.logoutOtherSessions !== false
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/users/me
 * Delete current user's account (GDPR compliance)
 */
router.delete('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const { password, confirmation } = req.body;

    // Require password confirmation
    if (!password) {
      return res.status(400).json({
        message: 'Password is required to delete account',
        code: 'MISSING_PASSWORD'
      });
    }

    // Require explicit confirmation
    if (confirmation !== 'DELETE_MY_ACCOUNT') {
      return res.status(400).json({
        message: 'Please confirm account deletion by sending { confirmation: "DELETE_MY_ACCOUNT" }',
        code: 'MISSING_CONFIRMATION'
      });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Password is incorrect',
        code: 'INVALID_PASSWORD'
      });
    }

    // Admins cannot delete themselves if they're the only admin
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        return res.status(400).json({
          message: 'Cannot delete the only admin account. Please assign admin role to another user first.',
          code: 'LAST_ADMIN'
        });
      }
    }

    // Invalidate all sessions
    await Session.invalidateAllForUser(user._id);

    // Delete activity logs (GDPR compliance - or keep for audit, based on policy)
    // For now, we'll anonymize instead of delete
    await ActivityLog.updateMany(
      { userId: user._id },
      { $set: { userId: null, details: { anonymized: true } } }
    );

    // Delete user
    await user.deleteOne();

    res.json({
      message: 'Account deleted successfully',
      code: 'ACCOUNT_DELETED'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/users/me/sessions
 * List all active sessions for current user
 */
router.get('/me/sessions', async (req, res) => {
  try {
    const sessions = await Session.getActiveSessions(req.user._id);

    // Get current session's refresh token from the cookie or header
    const currentToken = req.headers['x-refresh-token'] || req.query.currentToken;

    // Format sessions for display (hide sensitive token data)
    const formattedSessions = sessions.map(session => ({
      _id: session._id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: currentToken ? session.refreshToken === currentToken : false
    }));

    res.json({ sessions: formattedSessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/users/me/sessions/:id
 * Revoke a specific session
 */
router.delete('/me/sessions/:id', async (req, res) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!session) {
      return res.status(404).json({
        message: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    session.isValid = false;
    await session.save();

    // Log activity
    await logActivity({
      userId: req.user._id,
      action: 'session_revoke',
      category: 'auth',
      targetType: 'session',
      targetId: session._id,
      ipAddress: getClientIp(req)
    });

    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/users/me/sessions
 * Revoke all sessions except current
 */
router.delete('/me/sessions', async (req, res) => {
  try {
    const { exceptCurrent, currentRefreshToken } = req.body;

    if (exceptCurrent && currentRefreshToken) {
      // Invalidate all sessions except the current one
      await Session.updateMany(
        {
          userId: req.user._id,
          refreshToken: { $ne: currentRefreshToken },
          isValid: true
        },
        { isValid: false }
      );
    } else {
      // Invalidate all sessions
      await Session.invalidateAllForUser(req.user._id);
    }

    // Log activity
    await logActivity({
      userId: req.user._id,
      action: 'session_revoke_all',
      category: 'auth',
      ipAddress: getClientIp(req)
    });

    res.json({
      message: 'All sessions revoked successfully',
      keptCurrent: exceptCurrent && currentRefreshToken
    });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/users/me/export
 * Export all user data (GDPR compliance)
 */
router.get('/me/export', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Get user's activity log
    const activityLog = await ActivityLog.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(1000);

    // Get user's sessions
    const sessions = await Session.find({ userId: user._id });

    // Note: Collection data (cards, decks, etc.) would need to be fetched
    // from their respective models. This is handled in the main export.

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: user.toSafeObject(),
      sessions: sessions.map(s => ({
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        isValid: s.isValid
      })),
      activityLog: activityLog.map(a => ({
        action: a.action,
        category: a.category,
        targetType: a.targetType,
        targetName: a.targetName,
        createdAt: a.createdAt
      }))
    };

    // Log the export
    await logActivity({
      userId: user._id,
      action: 'data_export_gdpr',
      category: 'export',
      ipAddress: getClientIp(req)
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=mtg-tracker-user-data-${user.username}.json`);
    res.json(exportData);
  } catch (error) {
    console.error('Export user data error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/users/me/activity
 * Get current user's activity log
 */
router.get('/me/activity', async (req, res) => {
  try {
    const { limit = 50, skip = 0, category, action } = req.query;

    const activityLog = await ActivityLog.getForUser(req.user._id, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      category,
      action
    });

    res.json(activityLog);
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/users/me/avatar
 * Upload a new avatar (base64 image or preset)
 */
router.post('/me/avatar', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { imageData, preset } = req.body;

    // If preset is provided, just set it
    if (preset) {
      if (!preset.startsWith('preset:')) {
        return res.status(400).json({ message: 'Invalid preset format' });
      }
      user.avatarUrl = preset;
      await user.save();
      return res.json({ avatarUrl: preset });
    }

    // If image data is provided, save the file
    if (!imageData) {
      return res.status(400).json({ message: 'Either imageData or preset is required' });
    }

    // Parse base64 data
    let buffer;
    try {
      const matches = imageData.match(/^data:image\/(jpeg|jpg|png);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ message: 'Invalid image format. Must be base64 JPEG or PNG' });
      }

      const format = matches[1];
      const base64Data = matches[2];

      // Validate format
      if (!['jpeg', 'jpg', 'png'].includes(format)) {
        return res.status(400).json({ message: 'Only JPEG and PNG formats are allowed' });
      }

      buffer = Buffer.from(base64Data, 'base64');

      // Validate size (max 5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ message: 'Image must be smaller than 5MB' });
      }
    } catch (error) {
      return res.status(400).json({ message: 'Invalid image data' });
    }

    // Generate filename
    const filename = `${uuidv4()}.jpg`;
    const filepath = path.join(AVATAR_DIR, filename);

    // Ensure directory exists
    if (!fs.existsSync(AVATAR_DIR)) {
      fs.mkdirSync(AVATAR_DIR, { recursive: true });
    }

    // Delete old avatar if it exists and is a file (not a preset)
    if (user.avatarUrl && !user.avatarUrl.startsWith('preset:')) {
      const oldPath = path.join(AVATAR_DIR, path.basename(user.avatarUrl));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Save new avatar
    fs.writeFileSync(filepath, buffer);

    // Update user
    const avatarUrl = `/api/users/avatar/${filename}`;
    user.avatarUrl = avatarUrl;
    await user.save();

    // Return full URL for frontend
    const fullUrl = `${req.protocol}://${req.get('host')}${avatarUrl}`;
    res.json({ avatarUrl: fullUrl });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/users/me/avatar
 * Delete current user's avatar
 */
router.delete('/me/avatar', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete file if avatar is a file (not a preset)
    if (user.avatarUrl && !user.avatarUrl.startsWith('preset:')) {
      const filepath = path.join(AVATAR_DIR, path.basename(user.avatarUrl));
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }

    // Clear avatar
    user.avatarUrl = '';
    await user.save();

    res.json({ message: 'Avatar deleted' });
  } catch (error) {
    console.error('Delete avatar error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/users/ban-appeals - Submit a ban appeal (user-facing)
 */
router.post('/ban-appeals', async (req, res) => {
  try {
    const { banId, appealText } = req.body;
    if (!banId || !appealText) {
      return res.status(400).json({ message: 'banId and appealText are required' });
    }
    if (!mongoose.isValidObjectId(banId)) {
      return res.status(400).json({ message: 'Invalid banId' });
    }
    if (appealText.length < 20) {
      return res.status(400).json({ message: 'Appeal text must be at least 20 characters' });
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
 * GET /api/users/me/unlock-status
 * Which profile section unlocks does the current user own?
 */
router.get('/me/unlock-status', async (req, res) => {
  try {
    const level = await ForumLevel.findOne({ userId: req.user._id })
      .select('cosmetics').lean();

    const purchased = (level?.cosmetics?.purchased || []).map(String);

    const unlockCosmetics = await Cosmetic.find({
      category: { $in: ['favoriteCardsShowcase', 'deckShowcase', 'collectionStatsWidget', 'wishlistPreview'] },
      isActive: true,
    }).lean();

    const hasUnlock = (category) =>
      unlockCosmetics
        .filter(c => c.category === category)
        .some(c => purchased.includes(c._id.toString()));

    res.json({
      favoriteCardsShowcase: hasUnlock('favoriteCardsShowcase'),
      deckShowcase: hasUnlock('deckShowcase'),
      collectionStatsWidget: hasUnlock('collectionStatsWidget'),
      wishlistPreview: hasUnlock('wishlistPreview'),
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/**
 * PUT /api/users/pinned-cards
 * Set pinned cards for current user (max 5).
 * Body: { cards: [{ cardId?, scryfallId, name, imageUrl? }] }
 */
router.put('/pinned-cards', async (req, res) => {
  try {
    const { cards } = req.body;
    if (!Array.isArray(cards)) {
      return res.status(400).json({ message: 'cards must be an array' });
    }

    const validCards = cards
      .filter(c => c.name && c.scryfallId)
      .map(c => ({
        cardId: c.cardId || null,
        scryfallId: c.scryfallId,
        name: c.name,
        imageUrl: c.imageUrl || '',
      }));

    if (validCards.length > 5) {
      return res.status(400).json({ message: 'Maximum 5 pinned cards' });
    }

    await User.findByIdAndUpdate(req.user._id, { pinnedCards: validCards });
    res.json({ pinnedCards: validCards });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;

