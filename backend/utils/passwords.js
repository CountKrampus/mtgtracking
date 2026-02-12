const bcrypt = require('bcrypt');

// Bcrypt cost factor (12 is a good balance of security and performance)
const SALT_ROUNDS = 12;

// Password validation rules
const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: false, // Optional but recommended
  requireLowercase: false, // Optional but recommended
  requireNumber: false, // Optional but recommended
  requireSpecial: false // Optional but recommended
};

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Bcrypt hash
 * @returns {Promise<boolean>} True if password matches
 */
const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
const validatePasswordStrength = (password) => {
  const errors = [];

  if (!password) {
    return { isValid: false, errors: ['Password is required'] };
  }

  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`Password must be at least ${PASSWORD_RULES.minLength} characters`);
  }

  if (password.length > PASSWORD_RULES.maxLength) {
    errors.push(`Password cannot exceed ${PASSWORD_RULES.maxLength} characters`);
  }

  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_RULES.requireNumber && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_RULES.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common weak patterns
  const commonPatterns = [
    /^password$/i,
    /^123456/,
    /^qwerty/i,
    /^admin$/i,
    /^letmein$/i,
    /^welcome$/i,
    /^monkey$/i,
    /^dragon$/i,
    /^master$/i,
    /^abc123$/i
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('Password is too common. Please choose a stronger password');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Calculate password strength score (0-4)
 * @param {string} password - Password to evaluate
 * @returns {Object} { score: number, label: string }
 */
const getPasswordStrengthScore = (password) => {
  if (!password) return { score: 0, label: 'None' };

  let score = 0;

  // Length scoring
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety scoring
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

  // Normalize to 0-4 scale
  score = Math.min(4, Math.floor(score / 1.5));

  const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];

  return {
    score,
    label: labels[score]
  };
};

module.exports = {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  getPasswordStrengthScore,
  PASSWORD_RULES
};
