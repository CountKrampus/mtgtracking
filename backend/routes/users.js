const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Session = require('../models/Session');
const ActivityLog = require('../models/ActivityLog');
const { hashPassword, verifyPassword, validatePasswordStrength } = require('../utils/passwords');
const { verifyToken, requireAuth, isMultiUserEnabled } = require('../middleware/auth');
const { logActivity, getClientIp } = require('../middleware/activityLogger');

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

    const { displayName, email } = req.body;

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

module.exports = router;
