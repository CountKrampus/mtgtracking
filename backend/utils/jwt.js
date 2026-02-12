const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Get JWT secret from environment or generate a warning
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn('WARNING: JWT_SECRET not set in environment. Using insecure default for development only.');
    return 'insecure-development-secret-do-not-use-in-production';
  }
  return secret;
};

// Get expiry values from environment with defaults
const getAccessExpiry = () => process.env.JWT_ACCESS_EXPIRY || '15m';
const getRefreshExpiry = () => process.env.JWT_REFRESH_EXPIRY || '7d';

/**
 * Generate an access token for a user
 * @param {Object} user - User object with _id, email, username, role
 * @returns {string} JWT access token
 */
const generateAccessToken = (user) => {
  const payload = {
    userId: user._id,
    email: user.email,
    username: user.username,
    role: user.role,
    type: 'access'
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getAccessExpiry(),
    issuer: 'mtg-tracker',
    audience: 'mtg-tracker-users'
  });
};

/**
 * Generate a refresh token for a user
 * @param {Object} user - User object with _id
 * @returns {Object} { token, expiresAt } - JWT refresh token and expiry date
 */
const generateRefreshToken = (user) => {
  // Generate a unique token ID for tracking
  const tokenId = crypto.randomBytes(16).toString('hex');

  const payload = {
    userId: user._id,
    tokenId,
    type: 'refresh'
  };

  const token = jwt.sign(payload, getJwtSecret(), {
    expiresIn: getRefreshExpiry(),
    issuer: 'mtg-tracker',
    audience: 'mtg-tracker-users'
  });

  // Calculate expiry date
  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);

  return { token, expiresAt, tokenId };
};

/**
 * Verify an access token
 * @param {string} token - JWT access token
 * @returns {Object|null} Decoded payload if valid, null if invalid
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      issuer: 'mtg-tracker',
      audience: 'mtg-tracker-users'
    });

    // Ensure it's an access token
    if (decoded.type !== 'access') {
      return null;
    }

    return decoded;
  } catch (error) {
    // Token is invalid or expired
    return null;
  }
};

/**
 * Verify a refresh token
 * @param {string} token - JWT refresh token
 * @returns {Object|null} Decoded payload if valid, null if invalid
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      issuer: 'mtg-tracker',
      audience: 'mtg-tracker-users'
    });

    // Ensure it's a refresh token
    if (decoded.type !== 'refresh') {
      return null;
    }

    return decoded;
  } catch (error) {
    // Token is invalid or expired
    return null;
  }
};

/**
 * Decode a token without verification (for debugging/logging)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded payload without verification
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

/**
 * Get remaining time until token expires
 * @param {string} token - JWT token
 * @returns {number} Seconds until expiry, or 0 if expired/invalid
 */
const getTokenTimeRemaining = (token) => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return 0;

  const expiresAt = decoded.exp * 1000;
  const now = Date.now();
  const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));

  return remaining;
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  getTokenTimeRemaining,
  getJwtSecret,
  getAccessExpiry,
  getRefreshExpiry
};
