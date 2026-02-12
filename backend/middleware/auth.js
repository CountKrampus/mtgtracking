const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');

/**
 * Check if multi-user mode is enabled
 * @returns {boolean}
 */
const isMultiUserEnabled = () => {
  return process.env.MULTI_USER_ENABLED === 'true';
};

/**
 * Extract and verify JWT from Authorization header
 * Attaches req.user if valid token found
 * Does NOT block requests - just populates user if possible
 */
const verifyToken = async (req, res, next) => {
  // Skip if multi-user is not enabled
  if (!isMultiUserEnabled()) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided - continue without user
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      req.user = null;
      return next();
    }

    // Fetch user from database to ensure they still exist and are active
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      req.user = null;
      return next();
    }

    // Attach user to request
    req.user = user.toSafeObject();
    req.tokenPayload = decoded;

    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    req.user = null;
    next();
  }
};

/**
 * Require authentication
 * Blocks request if not authenticated (when multi-user enabled)
 */
const requireAuth = (req, res, next) => {
  // If multi-user is not enabled, allow all requests
  if (!isMultiUserEnabled()) {
    return next();
  }

  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  next();
};

/**
 * Require specific role(s)
 * Must be used after requireAuth
 * @param {...string} roles - Allowed roles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    // If multi-user is not enabled, allow all requests
    if (!isMultiUserEnabled()) {
      return next();
    }

    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Insufficient permissions',
        code: 'FORBIDDEN',
        requiredRoles: roles,
        currentRole: req.user.role
      });
    }

    next();
  };
};

/**
 * Check if user can edit (admin or editor role)
 */
const requireEditor = requireRole('admin', 'editor');

/**
 * Check if user is admin
 */
const requireAdmin = requireRole('admin');

/**
 * Check maintenance mode
 * Blocks non-admin users when maintenance mode is enabled
 */
const checkMaintenanceMode = async (req, res, next) => {
  // If multi-user is not enabled, skip maintenance check
  if (!isMultiUserEnabled()) {
    return next();
  }

  try {
    const maintenanceMode = await SystemSettings.getValue('maintenanceMode', false);

    if (maintenanceMode && (!req.user || req.user.role !== 'admin')) {
      return res.status(503).json({
        message: 'System is under maintenance. Please try again later.',
        code: 'MAINTENANCE_MODE'
      });
    }

    next();
  } catch (error) {
    console.error('Maintenance mode check error:', error.message);
    // On error, allow request to proceed
    next();
  }
};

/**
 * Rate limit by user (when authenticated)
 * This is a simple in-memory rate limiter for user-specific limits
 */
const userRateLimits = new Map();

const userRateLimit = (maxRequests = 100, windowMs = 60000) => {
  return (req, res, next) => {
    if (!isMultiUserEnabled() || !req.user) {
      return next();
    }

    const key = req.user._id.toString();
    const now = Date.now();

    let userData = userRateLimits.get(key);

    if (!userData || now - userData.windowStart > windowMs) {
      // Start new window
      userData = { count: 1, windowStart: now };
      userRateLimits.set(key, userData);
      return next();
    }

    userData.count++;

    if (userData.count > maxRequests) {
      return res.status(429).json({
        message: 'Too many requests. Please slow down.',
        code: 'RATE_LIMITED',
        retryAfter: Math.ceil((userData.windowStart + windowMs - now) / 1000)
      });
    }

    next();
  };
};

// Clean up rate limit data periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of userRateLimits.entries()) {
    if (now - data.windowStart > 60000) {
      userRateLimits.delete(key);
    }
  }
}, 60000);

module.exports = {
  isMultiUserEnabled,
  verifyToken,
  requireAuth,
  requireRole,
  requireEditor,
  requireAdmin,
  checkMaintenanceMode,
  userRateLimit
};
