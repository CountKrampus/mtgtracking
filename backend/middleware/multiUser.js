const { isMultiUserEnabled } = require('./auth');

/**
 * Middleware to inject userId filter into database queries
 * When multi-user is enabled, this ensures users only see their own data
 */

/**
 * Add userId to query filters for GET requests
 * Modifies req.query to include userId filter
 */
const injectUserFilter = (req, res, next) => {
  if (!isMultiUserEnabled()) {
    return next();
  }

  if (!req.user) {
    // User not authenticated - this should be caught by requireAuth
    return next();
  }

  // Store the user ID in a consistent location for route handlers
  req.userIdFilter = { userId: req.user._id };

  next();
};

/**
 * Add userId to request body for POST/PUT requests
 * Ensures new resources are associated with the current user
 */
const injectUserId = (req, res, next) => {
  if (!isMultiUserEnabled()) {
    return next();
  }

  if (!req.user) {
    return next();
  }

  // For POST/PUT requests with a body, add userId
  if (req.body && typeof req.body === 'object') {
    req.body.userId = req.user._id;
  }

  next();
};

/**
 * Verify resource ownership before update/delete
 * Checks if the resource belongs to the current user
 * @param {Function} getResource - Async function that returns the resource by ID
 */
const verifyOwnership = (getResource) => {
  return async (req, res, next) => {
    if (!isMultiUserEnabled()) {
      return next();
    }

    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    try {
      const resource = await getResource(req);

      if (!resource) {
        return res.status(404).json({
          message: 'Resource not found',
          code: 'NOT_FOUND'
        });
      }

      // Admins can access any resource
      if (req.user.role === 'admin') {
        req.resource = resource;
        return next();
      }

      // Check if resource belongs to user
      const resourceUserId = resource.userId?.toString();
      const currentUserId = req.user._id.toString();

      if (resourceUserId && resourceUserId !== currentUserId) {
        return res.status(403).json({
          message: 'You do not have permission to access this resource',
          code: 'FORBIDDEN'
        });
      }

      // Resource has no userId (legacy data) - only allow if user is admin
      if (!resourceUserId) {
        return res.status(403).json({
          message: 'This resource has not been assigned to any user',
          code: 'ORPHANED_RESOURCE'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      console.error('Ownership verification error:', error.message);
      return res.status(500).json({
        message: 'Error verifying resource ownership',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

/**
 * Build a MongoDB query that filters by userId
 * @param {Object} baseQuery - The original query
 * @param {Object} req - Express request object
 * @returns {Object} Query with userId filter applied
 */
const buildUserQuery = (baseQuery, req) => {
  if (!isMultiUserEnabled() || !req.user) {
    return baseQuery;
  }

  // Admins can optionally view all data
  if (req.user.role === 'admin' && req.query.viewAll === 'true') {
    return baseQuery;
  }

  return {
    ...baseQuery,
    userId: req.user._id
  };
};

/**
 * Helper to get userId for creating new resources
 * @param {Object} req - Express request object
 * @returns {ObjectId|null} User ID or null if multi-user disabled
 */
const getUserId = (req) => {
  if (!isMultiUserEnabled() || !req.user) {
    return null;
  }
  return req.user._id;
};

/**
 * Combined middleware for typical resource routes
 * Applies both filter injection and userId injection
 */
const multiUserMiddleware = [injectUserFilter, injectUserId];

module.exports = {
  injectUserFilter,
  injectUserId,
  verifyOwnership,
  buildUserQuery,
  getUserId,
  multiUserMiddleware
};
