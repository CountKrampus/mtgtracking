const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Session = require('../models/Session');
const SystemSettings = require('../models/SystemSettings');
const { hashPassword, verifyPassword, validatePasswordStrength } = require('../utils/passwords');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { isMultiUserEnabled, verifyToken, requireAuth } = require('../middleware/auth');
const { logActivity, getClientIp } = require('../middleware/activityLogger');

/**
 * GET /api/auth/status
 * Check if multi-user mode is enabled and get system status
 */
router.get('/status', async (req, res) => {
  try {
    const multiUserEnabled = isMultiUserEnabled();

    let registrationEnabled = true;
    let maintenanceMode = false;

    if (multiUserEnabled) {
      registrationEnabled = await SystemSettings.getValue('registrationEnabled', true);
      maintenanceMode = await SystemSettings.getValue('maintenanceMode', false);
    }

    res.json({
      multiUserEnabled,
      registrationEnabled,
      maintenanceMode
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/auth/register
 * Create a new user account
 */
router.post('/register', async (req, res) => {
  try {
    // Check if multi-user is enabled
    if (!isMultiUserEnabled()) {
      return res.status(400).json({
        message: 'Multi-user mode is not enabled',
        code: 'MULTI_USER_DISABLED'
      });
    }

    // Check if registration is enabled
    const registrationEnabled = await SystemSettings.getValue('registrationEnabled', true);
    if (!registrationEnabled) {
      return res.status(403).json({
        message: 'Registration is currently disabled',
        code: 'REGISTRATION_DISABLED'
      });
    }

    const { email, username, password, displayName } = req.body;

    // Validate required fields
    if (!email || !username || !password) {
      return res.status(400).json({
        message: 'Email, username, and password are required',
        code: 'MISSING_FIELDS'
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        message: 'Password does not meet requirements',
        code: 'WEAK_PASSWORD',
        errors: passwordValidation.errors
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        message: 'Email is already registered',
        code: 'EMAIL_EXISTS'
      });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(400).json({
        message: 'Username is already taken',
        code: 'USERNAME_EXISTS'
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Determine role - first user becomes admin
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : await SystemSettings.getValue('defaultUserRole', 'editor');

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      passwordHash,
      displayName: displayName || username,
      role
    });

    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const { token: refreshToken, expiresAt } = generateRefreshToken(user);

    // Create session
    await new Session({
      userId: user._id,
      refreshToken,
      userAgent: req.headers['user-agent'] || '',
      ipAddress: getClientIp(req),
      expiresAt
    }).save();

    // Log activity
    await logActivity({
      userId: user._id,
      action: 'register',
      category: 'auth',
      targetType: 'user',
      targetId: user._id,
      targetName: user.username,
      ipAddress: getClientIp(req)
    });

    res.status(201).json({
      message: 'Registration successful',
      user: user.toSafeObject(),
      accessToken,
      refreshToken,
      isFirstUser: userCount === 0
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Email or username already exists',
        code: 'DUPLICATE_USER'
      });
    }
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
router.post('/login', async (req, res) => {
  try {
    if (!isMultiUserEnabled()) {
      return res.status(400).json({
        message: 'Multi-user mode is not enabled',
        code: 'MULTI_USER_DISABLED'
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Find user by email or username
    const user = await User.findByEmailOrUsername(email);

    if (!user) {
      return res.status(401).json({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        message: 'Account is deactivated. Please contact an administrator.',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check maintenance mode
    const maintenanceMode = await SystemSettings.getValue('maintenanceMode', false);
    if (maintenanceMode && user.role !== 'admin') {
      return res.status(503).json({
        message: 'System is under maintenance. Please try again later.',
        code: 'MAINTENANCE_MODE'
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const { token: refreshToken, expiresAt } = generateRefreshToken(user);

    // Create session
    await new Session({
      userId: user._id,
      refreshToken,
      userAgent: req.headers['user-agent'] || '',
      ipAddress: getClientIp(req),
      expiresAt
    }).save();

    // Cleanup old sessions if user has too many
    const maxSessions = await SystemSettings.getValue('maxSessionsPerUser', 10);
    const activeSessions = await Session.getActiveSessions(user._id);

    if (activeSessions.length > maxSessions) {
      // Invalidate oldest sessions
      const sessionsToInvalidate = activeSessions.slice(maxSessions);
      for (const session of sessionsToInvalidate) {
        session.isValid = false;
        await session.save();
      }
    }

    // Log activity
    await logActivity({
      userId: user._id,
      action: 'login',
      category: 'auth',
      ipAddress: getClientIp(req)
    });

    res.json({
      message: 'Login successful',
      user: user.toSafeObject(),
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/auth/logout
 * Invalidate refresh token
 */
router.post('/logout', verifyToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await Session.invalidateSession(refreshToken);
    }

    // Log activity
    if (req.user) {
      await logActivity({
        userId: req.user._id,
        action: 'logout',
        category: 'auth',
        ipAddress: getClientIp(req)
      });
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * POST /api/auth/refresh
 * Get new access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    if (!isMultiUserEnabled()) {
      return res.status(400).json({
        message: 'Multi-user mode is not enabled',
        code: 'MULTI_USER_DISABLED'
      });
    }

    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        message: 'Refresh token is required',
        code: 'MISSING_TOKEN'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return res.status(401).json({
        message: 'Invalid or expired refresh token',
        code: 'INVALID_TOKEN'
      });
    }

    // Check if session exists and is valid
    const session = await Session.findOne({
      refreshToken,
      isValid: true,
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      return res.status(401).json({
        message: 'Session not found or expired',
        code: 'SESSION_INVALID'
      });
    }

    // Get user
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      // Invalidate the session
      await Session.invalidateSession(refreshToken);

      return res.status(401).json({
        message: 'User not found or deactivated',
        code: 'USER_INVALID'
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken(user);

    res.json({
      accessToken,
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', verifyToken, requireAuth, async (req, res) => {
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
    console.error('Get user error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
