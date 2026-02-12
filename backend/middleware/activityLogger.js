const ActivityLog = require('../models/ActivityLog');
const { isMultiUserEnabled } = require('./auth');

/**
 * Log an activity to the database
 * @param {Object} params - Activity parameters
 */
const logActivity = async (params) => {
  // Only log if multi-user is enabled
  if (!isMultiUserEnabled()) {
    return;
  }

  try {
    await ActivityLog.log(params);
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('Activity logging failed:', error.message);
  }
};

/**
 * Get client IP address from request
 * Handles proxied requests (X-Forwarded-For)
 */
const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
};

/**
 * Create an activity logger middleware for a specific action
 * @param {string} action - The action type
 * @param {string} category - The category
 * @param {Function} getDetails - Optional function to extract details from req/res
 */
const createActivityLogger = (action, category, getDetails = null) => {
  return async (req, res, next) => {
    // Store the original res.json to intercept the response
    const originalJson = res.json.bind(res);

    res.json = async function(data) {
      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const details = getDetails ? getDetails(req, data) : null;

        await logActivity({
          userId: req.user._id,
          action,
          category,
          targetType: details?.targetType || null,
          targetId: details?.targetId || null,
          targetName: details?.targetName || null,
          details: details?.extra || null,
          ipAddress: getClientIp(req)
        });
      }

      return originalJson(data);
    };

    next();
  };
};

/**
 * Predefined activity loggers for common actions
 */
const activityLoggers = {
  // Auth activities
  login: createActivityLogger('login', 'auth', (req) => ({
    extra: { email: req.body.email }
  })),

  logout: createActivityLogger('logout', 'auth'),

  register: createActivityLogger('register', 'auth', (req, data) => ({
    targetType: 'user',
    targetId: data?.user?._id,
    targetName: data?.user?.username
  })),

  passwordChange: createActivityLogger('password_change', 'auth'),

  // Collection activities
  cardCreate: createActivityLogger('card_create', 'collection', (req, data) => ({
    targetType: 'card',
    targetId: data?._id,
    targetName: data?.name,
    extra: { quantity: data?.quantity }
  })),

  cardUpdate: createActivityLogger('card_update', 'collection', (req, data) => ({
    targetType: 'card',
    targetId: data?._id,
    targetName: data?.name
  })),

  cardDelete: createActivityLogger('card_delete', 'collection', (req) => ({
    targetType: 'card',
    targetId: req.params.id
  })),

  cardBulkImport: createActivityLogger('card_bulk_import', 'collection', (req, data) => ({
    extra: {
      total: data?.total,
      added: data?.added?.length,
      merged: data?.merged?.length,
      failed: data?.failed?.length
    }
  })),

  cardBulkUpdate: createActivityLogger('card_bulk_update', 'collection', (req, data) => ({
    extra: {
      updated: data?.updated,
      total: data?.total
    }
  })),

  cardBulkDelete: createActivityLogger('card_bulk_delete', 'collection', (req, data) => ({
    extra: {
      deleted: data?.deleted,
      total: data?.total
    }
  })),

  priceUpdate: createActivityLogger('price_update', 'collection', (req, data) => ({
    targetType: 'card',
    targetId: data?._id,
    targetName: data?.name
  })),

  priceBulkUpdate: createActivityLogger('price_bulk_update', 'collection', (req, data) => ({
    extra: {
      updated: data?.updated,
      skipped: data?.skipped,
      total: data?.total
    }
  })),

  // Deck activities
  deckCreate: createActivityLogger('deck_create', 'deck', (req, data) => ({
    targetType: 'deck',
    targetId: data?._id,
    targetName: data?.name
  })),

  deckUpdate: createActivityLogger('deck_update', 'deck', (req, data) => ({
    targetType: 'deck',
    targetId: data?._id,
    targetName: data?.name
  })),

  deckDelete: createActivityLogger('deck_delete', 'deck', (req) => ({
    targetType: 'deck',
    targetId: req.params.id
  })),

  // Wishlist activities
  wishlistAdd: createActivityLogger('wishlist_add', 'wishlist', (req, data) => ({
    targetType: 'wishlist',
    targetId: data?._id,
    targetName: data?.name
  })),

  wishlistUpdate: createActivityLogger('wishlist_update', 'wishlist', (req, data) => ({
    targetType: 'wishlist',
    targetId: data?._id,
    targetName: data?.name
  })),

  wishlistDelete: createActivityLogger('wishlist_delete', 'wishlist', (req) => ({
    targetType: 'wishlist',
    targetId: req.params.id
  })),

  wishlistAcquire: createActivityLogger('wishlist_acquire', 'wishlist', (req, data) => ({
    targetType: 'wishlist',
    targetId: req.params.id,
    targetName: data?.card?.name
  })),

  // Location activities
  locationCreate: createActivityLogger('location_create', 'location', (req, data) => ({
    targetType: 'location',
    targetId: data?._id,
    targetName: data?.name
  })),

  locationUpdate: createActivityLogger('location_update', 'location', (req, data) => ({
    targetType: 'location',
    targetId: data?._id,
    targetName: data?.name
  })),

  locationDelete: createActivityLogger('location_delete', 'location', (req) => ({
    targetType: 'location',
    targetId: req.params.id
  })),

  // Tag activities
  tagCreate: createActivityLogger('tag_create', 'tag', (req, data) => ({
    targetType: 'tag',
    targetId: data?._id,
    targetName: data?.name
  })),

  tagUpdate: createActivityLogger('tag_update', 'tag', (req, data) => ({
    targetType: 'tag',
    targetName: req.params.name
  })),

  tagDelete: createActivityLogger('tag_delete', 'tag', (req) => ({
    targetType: 'tag',
    targetName: req.params.name
  })),

  // Export activities
  exportJson: createActivityLogger('export_json', 'export'),
  exportCsv: createActivityLogger('export_csv', 'export'),
  dataExportGdpr: createActivityLogger('data_export_gdpr', 'export'),

  // Admin activities
  userRoleChange: createActivityLogger('user_role_change', 'admin', (req, data) => ({
    targetType: 'user',
    targetId: req.params.id,
    targetName: data?.username,
    extra: { newRole: req.body.role }
  })),

  userDeactivate: createActivityLogger('user_deactivate', 'admin', (req) => ({
    targetType: 'user',
    targetId: req.params.id
  })),

  userActivate: createActivityLogger('user_activate', 'admin', (req) => ({
    targetType: 'user',
    targetId: req.params.id
  })),

  dataMigrate: createActivityLogger('data_migrate', 'admin', (req, data) => ({
    extra: data
  })),

  maintenanceToggle: createActivityLogger('maintenance_toggle', 'admin', (req) => ({
    extra: { enabled: req.body.enabled }
  })),

  settingsUpdate: createActivityLogger('settings_update', 'admin', (req) => ({
    targetType: 'settings',
    targetName: req.params.key,
    extra: { value: req.body.value }
  }))
};

module.exports = {
  logActivity,
  getClientIp,
  createActivityLogger,
  activityLoggers
};
