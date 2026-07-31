require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');

// Scryfall asks API consumers to identify themselves via User-Agent; requests
// without one are more likely to get soft rate-limited under sustained load
// (e.g. during bulk price/full-data updates). This is a process-wide default
// since axios is a singleton module shared with utils/pricing.js.
axios.defaults.headers.common['User-Agent'] = 'MTGTracker/1.0 (+https://github.com/mtg-tracker)';
const deckRoutes = require('./routes/decks');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const rolesRoutes = require('./routes/roles');
const forumRouter = require('./routes/forum');
const notificationsRouter = require('./routes/notifications');
const messagesRouter = require('./routes/messages');
const { cachedApiCall } = require('./utils/apiCache');
const { getFromCache, setInCache, clearCache } = require('./utils/statsCache');
const { CACHE_DIR, cacheCardImage } = require('./utils/imageCache');
const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const { isMultiUserEnabled, verifyToken, requireAuth, requireEditor, requirePermission, checkMaintenanceMode } = require('./middleware/auth');
const { buildUserQuery, getUserId } = require('./middleware/multiUser');
const { activityLoggers } = require('./middleware/activityLogger');
const { getPriceWithFallback } = require('./utils/pricing');
const { fetchCardFromScryfall } = require('./utils/scryfallLookup');
const { registerDailySnapshotJob } = require('./jobs/dailyPriceSnapshot');
const { registerWeeklyHealthReportJob } = require('./jobs/weeklyHealthReport');
const { registerSetReleaseAnnouncerJob } = require('./jobs/setReleaseAnnouncer');
const SystemSettings = require('./models/SystemSettings');
const UserColumnPreferences = require('./models/UserColumnPreferences');
const CardValueSnapshot = require('./models/CardValueSnapshot');
const CardPriceHistory = require('./models/CardPriceHistory');
const CardPriceSnapshot = require('./models/CardPriceSnapshot');
const ValueSnapshot = require('./models/ValueSnapshot');
const User = require('./models/User');
const Role = require('./models/Role');
const { refreshRoleCache } = require('./utils/permissions');

// Try to load sharp for image hashing (optional dependency)
let sharp = null;
try {
  sharp = require('sharp');
  console.log('Sharp loaded successfully - image matching enabled');
} catch (e) {
  console.log('Sharp not available - image matching disabled. Run: npm install sharp');
}

const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust the Caddy reverse proxy running in front of this server (single hop) so
// express-rate-limit can safely read X-Forwarded-For for per-client rate limiting.
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});
const scryfallLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many Scryfall requests, please try again later.' }
});
app.use('/api/', generalLimiter);
app.use('/api/scryfall/', scryfallLimiter);

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mtg-tracker';
mongoose.connect(MONGODB_URI)
.then(async () => {
  console.log('MongoDB connected successfully');
  // Initialize system settings if multi-user mode is enabled
  if (isMultiUserEnabled()) {
    await SystemSettings.initializeDefaults();
    console.log('Multi-user mode enabled - system settings initialized');
  }
  // Seed built-in roles (Role collection) and load the in-memory permission
  // cache used by getPermissionsForRole()/hasPermission()
  // (backend/utils/permissions.js). Runs regardless of multi-user mode so
  // the Role collection and cache are always consistent.
  await Role.seedBuiltInRoles();
  await Role.grantMigrationPermissions();
  await refreshRoleCache();
  console.log('Roles seeded and permission cache loaded');
})
.catch(err => console.error('MongoDB connection error:', err));

// Serve user avatars (public endpoint - must be before auth middleware)
const AVATAR_DIR = path.join(__dirname, 'user-avatars');
app.get('/api/users/avatar/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    // Prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ message: 'Invalid filename' });
    }
    const filepath = path.join(AVATAR_DIR, filename);
    res.sendFile(filepath);
  } catch (error) {
    res.status(404).json({ message: 'Avatar not found' });
  }
});

// Auth middleware - verify token for all requests (populates req.user if valid token)
app.use(verifyToken);

// Mount auth routes (these don't require authentication)
app.use('/api/auth', authRoutes);

// Public user profile endpoint (no auth required â€” must be before the auth-protected users router)
app.use('/api/users', require('./routes/usersPublic'));

// Mount user routes (require authentication)
app.use('/api/users', userRoutes);

// Mount admin routes (require admin role)
app.use('/api/admin', adminRoutes);
app.use('/api/admin/roles', rolesRoutes);

// Mount forum routes
app.use('/api/forum', forumRouter);

// Mount notifications routes
app.use('/api/notifications', notificationsRouter);

// Mount messages routes
app.use('/api/messages', messagesRouter);

// Mount health report routes
app.use('/api/health-report', require('./routes/healthReport'));

// Mount trades routes
app.use('/api/trades', require('./routes/trades'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/challenges', require('./routes/challenges'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/cards', require('./routes/priceFlags'));
app.use('/api/cards', require('./routes/cardInsights'));
app.use('/api/commanders', require('./routes/commanders'));
app.use('/api/sets', require('./routes/sets'));
app.use('/api/discord', require('./routes/discord'));

// Mount achievements routes
const achievementsRouter = require('./routes/achievements');
app.use('/api/achievements', achievementsRouter);

// Check maintenance mode for all other routes
app.use(checkMaintenanceMode);

// Card Schema
const cardSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: { type: String, required: true },
  set: { type: String, required: false, default: 'Unknown' },
  setCode: { type: String, required: false },
  collectorNumber: { type: String, required: false },
  rarity: { type: String, required: false },
  quantity: { type: Number, required: true, default: 1 },
  condition: { type: String, required: true, enum: ['NM', 'LP', 'MP', 'HP', 'DMG'] },
  price: { type: Number, required: true, default: 0 },
  lastPrice: { type: Number, default: null },
  purchasePrice: { type: Number, default: null },
  colors: [{ type: String }],
  types: [{ type: String }],
  manaCost: { type: String },
  scryfallId: { type: String },
  imageUrl: { type: String },
  isFoil: { type: Boolean, default: false },
  isToken: { type: Boolean, default: false },
  oracleText: { type: String, default: '' },
  tags: [{ type: String }],
  location: { type: String, default: '' },
  buylistValue: { type: Number, default: 0 },
  sellValue: { type: Number, default: 0 },
  priceAlert: {
    targetPrice: Number, // notify when price drops to/below this
    targetHigh: Number, // notify when price rises to/above this
    emailNotification: { type: Boolean, default: false },
    lastAlertFiredAt: { type: Date, default: null },
    lastHighAlertFiredAt: { type: Date, default: null }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Database indexes for query performance
cardSchema.index({ name: 1 });
cardSchema.index({ set: 1 });
cardSchema.index({ setCode: 1 });
cardSchema.index({ rarity: 1 });
cardSchema.index({ condition: 1 });
cardSchema.index({ location: 1 });
cardSchema.index({ colors: 1 });
cardSchema.index({ types: 1 });
cardSchema.index({ tags: 1 });
cardSchema.index({ name: 1, set: 1, condition: 1 }); // Compound index for duplicate detection

// Multi-user specific indexes for faster queries
cardSchema.index({ userId: 1, name: 1 });
cardSchema.index({ userId: 1, set: 1 });
cardSchema.index({ userId: 1, condition: 1 });
cardSchema.index({ userId: 1, updatedAt: -1 });

// Location Schema
const locationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  ignorePrice: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Location = mongoose.model('Location', locationSchema);

// Tag Schema (for managing tag metadata like ignorePrice)
const tagSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: { type: String, required: true },
  ignorePrice: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Tag = mongoose.model('Tag', tagSchema);

// Wishlist Item Schema
const wishlistItemSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: { type: String, required: true },
  set: { type: String, default: '' },
  setCode: { type: String, default: '' },
  scryfallId: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  colors: [{ type: String }],
  types: [{ type: String }],
  manaCost: { type: String, default: '' },
  rarity: { type: String, default: '' },
  targetPrice: { type: Number, default: 0 },
  currentPrice: { type: Number, default: 0 },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  notes: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  condition: { type: String, default: 'NM' },
  oracleText: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

wishlistItemSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const WishlistItem = mongoose.model('WishlistItem', wishlistItemSchema);

// Deck Value Snapshot Schema (for value history over time)
const deckValueSnapshotSchema = new mongoose.Schema({
  deckId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  value: { type: Number, required: true },
  cardCount: { type: Number },
  createdAt: { type: Date, default: Date.now }
});
deckValueSnapshotSchema.index({ deckId: 1, createdAt: 1 });
const DeckValueSnapshot = mongoose.model('DeckValueSnapshot', deckValueSnapshotSchema);

// Deck Change Schema (evolution timeline)
const deckChangeSchema = new mongoose.Schema({
  deckId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  changes: [{
    type: { type: String, enum: ['add', 'remove'] },
    cardName: { type: String },
    scryfallId: { type: String },
    quantity: { type: Number, default: 1 }
  }],
  createdAt: { type: Date, default: Date.now }
});
deckChangeSchema.index({ deckId: 1, createdAt: -1 });
const DeckChange = mongoose.model('DeckChange', deckChangeSchema);

// ============================================
// LIFE COUNTER SCHEMAS
// ============================================

// Player Profile Schema (for life counter)
const playerProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: { type: String, required: true },
  avatarColor: { type: String, default: '#6366f1' },
  backgroundImage: { type: String, default: '' }, // URL or data URL for background
  backgroundType: { type: String, enum: ['none', 'upload', 'scryfall', 'commander'], default: 'none' },
  commanderName: { type: String, default: '' }, // For auto-fill commander art
  createdAt: { type: Date, default: Date.now }
});

const PlayerProfile = mongoose.model('PlayerProfile', playerProfileSchema);

// Game Session Schema (for life counter history)
const gameSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  players: [{
    name: String,
    finalLife: Number,
    isWinner: Boolean,
    placement: Number,
    color: String,
    deckId: { type: mongoose.Schema.Types.ObjectId, ref: 'Deck', default: null },
    commanderName: { type: String, default: '' }
  }],
  format: { type: String, default: 'commander' },
  winner: { type: String },
  turns: { type: Number, default: 0 },
  duration: { type: Number, default: 0 }, // in seconds
  gameLog: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

const GameSession = mongoose.model('GameSession', gameSessionSchema);

// Shared Game State Schema (for sharing games via link)
const sharedGameSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  gameState: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Expires after 24 hours
});

const SharedGame = mongoose.model('SharedGame', sharedGameSchema);

cardSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Card = mongoose.model('Card', cardSchema);

// Helper Functions

// Routes

// Autocomplete card names from Scryfall
app.get('/api/scryfall/autocomplete', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const cacheKey = `autocomplete:${q.toLowerCase()}`;
    const data = await cachedApiCall(cacheKey, async () => {
      const response = await axios.get(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(q)}`);
      return response.data.data || [];
    });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mount deck routes
deckRoutes.injectDependencies(Card, getPriceWithFallback, GameSession);
app.use('/api/decks', deckRoutes);

// Deck folder routes
const deckFolderRoutes = require('./routes/deckFolders');
app.use('/api/deck-folders', deckFolderRoutes);

// Search Scryfall API for card data and pricing
app.get('/api/scryfall/search', async (req, res) => {
  try {
    const { name, setCode, collectorNumber } = req.query;
    if (!name) return res.status(400).json({ message: 'Card name required' });

    // Get card data from Scryfall (cached for 24 hours)
    const cacheKey = `scryfall:${name.toLowerCase()}:${(setCode || '').toLowerCase()}:${collectorNumber || ''}`;
    const { cardData } = await cachedApiCall(cacheKey, () => fetchCardFromScryfall(name, setCode, collectorNumber));

    // Get pricing from Scryfall (with MTGGoldfish backup)
    const priceData = await getPriceWithFallback(name);

    // Cache image and get local URL
    const scryfallImageUrl = cardData.image_uris ? cardData.image_uris.normal : null;
    const cachedImageUrl = await cacheCardImage(cardData.id, scryfallImageUrl);

    res.json({
      name: cardData.name,
      set: cardData.set_name,
      setCode: cardData.set.toUpperCase(),
      collectorNumber: cardData.collector_number,
      rarity: cardData.rarity[0].toUpperCase(),
      colors: cardData.colors || [],
      types: cardData.type_line ? cardData.type_line.split('â€”')[0].trim().split(' ') : [],
      manaCost: cardData.mana_cost || '',
      scryfallId: cardData.id,
      imageUrl: cachedImageUrl,
      oracleText: cardData.oracle_text || '',
      prices: {
        usd: priceData.usd,
        cad: priceData.cad,
        source: priceData.source
      }
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      res.status(404).json({ message: 'Card not found on Scryfall' });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

// Clear entire collection
app.delete('/api/collection/clear-all', requireAuth, requireEditor, async (req, res) => {
  try {
    const { confirmation } = req.body;
    if (confirmation !== 'DELETE_ALL_CARDS') {
      return res.status(400).json({ message: 'Missing confirmation. Send { confirmation: "DELETE_ALL_CARDS" }' });
    }
    const query = buildUserQuery({}, req);
    const result = await Card.deleteMany(query);
    res.json({ deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Clear image cache
app.delete('/api/cache/clear', requireAuth, requireEditor, async (req, res) => {
  try {
    let deletedCount = 0;
    if (fs.existsSync(CACHE_DIR)) {
      const files = fs.readdirSync(CACHE_DIR);
      for (const file of files) {
        if (file.endsWith('.jpg') || file.endsWith('.png')) {
          fs.unlinkSync(path.join(CACHE_DIR, file));
          deletedCount++;
        }
      }
    }
    res.json({ deletedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export collection as JSON
app.get('/api/export/json', requireAuth, activityLoggers.exportJson, async (req, res) => {
  try {
    const query = buildUserQuery({}, req);
    const cards = await Card.find(query);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=mtg-collection.json');
    res.json(cards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Export collection as CSV
app.get('/api/export/csv', requireAuth, activityLoggers.exportCsv, async (req, res) => {
  try {
    const query = buildUserQuery({}, req);
    const cards = await Card.find(query);

    // Helper to escape CSV fields
    const escapeCSV = (str) => str ? `"${String(str).replace(/"/g, '""')}"` : '""';

    const csvHeader = 'Name,Set,Set Code,Collector Number,Rarity,Quantity,Condition,Price,Total Value,Colors,Types,Mana Cost,Tags,Location,Is Token,Is Foil,Scryfall ID,Image URL,Oracle Text,Created At,Updated At\n';
    const csvRows = cards.map(card => {
      const colors = card.colors ? card.colors.join(';') : '';
      const types = card.types ? card.types.join(';') : '';
      const tags = card.tags ? card.tags.join(';') : '';
      const totalValue = card.price * card.quantity;
      return [
        escapeCSV(card.name),
        escapeCSV(card.set),
        escapeCSV(card.setCode),
        escapeCSV(card.collectorNumber),
        escapeCSV(card.rarity),
        card.quantity,
        escapeCSV(card.condition),
        card.price,
        totalValue,
        escapeCSV(colors),
        escapeCSV(types),
        escapeCSV(card.manaCost),
        escapeCSV(tags),
        escapeCSV(card.location),
        card.isToken ? 'Yes' : 'No',
        card.isFoil ? 'Yes' : 'No',
        escapeCSV(card.scryfallId),
        escapeCSV(card.imageUrl),
        escapeCSV(card.oracleText),
        card.createdAt ? card.createdAt.toISOString() : '',
        card.updatedAt ? card.updatedAt.toISOString() : ''
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=mtg-collection.csv');
    res.send(csvHeader + csvRows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get collection statistics
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);

    // Check cache first
    const cached = getFromCache('stats', userId);
    if (cached) {
      return res.json(cached);
    }

    const cardQuery = buildUserQuery({}, req);
    const cards = await Card.find(cardQuery);

    // Get locations and tags with ignorePrice set (scoped to user)
    const locationQuery = buildUserQuery({ ignorePrice: true }, req);
    const locations = await Location.find(locationQuery);
    const ignoredLocations = new Set(locations.map(l => l.name));

    const tagQuery = buildUserQuery({ ignorePrice: true }, req);
    const tags = await Tag.find(tagQuery);
    const ignoredTags = new Set(tags.map(t => t.name));

    // Helper to check if card should be ignored for price calculation
    const shouldIgnorePrice = (card) => {
      if (card.location && ignoredLocations.has(card.location)) return true;
      if (card.tags && card.tags.some(tag => ignoredTags.has(tag))) return true;
      return false;
    };

    const totalCards = cards.reduce((sum, card) => sum + card.quantity, 0);
    const totalValue = cards.reduce((sum, card) => {
      if (shouldIgnorePrice(card)) return sum;
      return sum + (card.price * card.quantity);
    }, 0);

    // Also calculate ignored value for reference
    const ignoredValue = cards.reduce((sum, card) => {
      if (!shouldIgnorePrice(card)) return sum;
      return sum + (card.price * card.quantity);
    }, 0);

    const colorStats = {};
    const typeStats = {};

    cards.forEach(card => {
      if (card.colors) {
        card.colors.forEach(color => {
          colorStats[color] = (colorStats[color] || 0) + card.quantity;
        });
      }
      if (card.types) {
        card.types.forEach(type => {
          typeStats[type] = (typeStats[type] || 0) + card.quantity;
        });
      }
    });

    // Count cached images
    let cachedImageCount = 0;
    try {
      if (fs.existsSync(CACHE_DIR)) {
        const files = fs.readdirSync(CACHE_DIR);
        cachedImageCount = files.filter(f => f.endsWith('.jpg') || f.endsWith('.png')).length;
      }
    } catch {
      // ignore errors counting cache
    }

    // Save daily value snapshot (once per day per user)
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const existingSnap = await ValueSnapshot.findOne(buildUserQuery({ createdAt: { $gte: todayStart } }, req));
      if (!existingSnap) {
        await ValueSnapshot.create({ ...buildUserQuery({}, req), value: totalValue, cardCount: totalCards });
      }
    } catch {
      // Non-critical: don't fail the stats response if snapshot fails
    }

    // Portfolio P&L (only for cards with purchasePrice set)
    let portfolioGain = 0, portfolioCost = 0;
    cards.forEach(card => {
      if (card.purchasePrice != null && card.purchasePrice > 0) {
        portfolioCost += card.purchasePrice * card.quantity;
        portfolioGain += (card.price - card.purchasePrice) * card.quantity;
      }
    });

    const stats = {
      totalCards,
      uniqueCards: cards.length,
      totalValue,
      ignoredValue,
      colorDistribution: colorStats,
      typeDistribution: typeStats,
      cachedImageCount,
      portfolioGain,
      portfolioCost
    };

    // Store in cache
    setInCache('stats', userId, stats);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get collection value history with optional date range
app.get('/api/stats/value-history', requireAuth, async (req, res) => {
  try {
    const userQ = buildUserQuery({}, req);

    // Find earliest snapshot date for date picker clamping
    const earliestSnap = await ValueSnapshot.findOne(userQ).sort({ createdAt: 1 }).lean();
    const earliest = earliestSnap
      ? new Date(earliestSnap.createdAt).toISOString().slice(0, 10)
      : null;

    // Parse optional from/to params; default to last 90 days
    let from, to;
    if (req.query.from && req.query.to) {
      from = new Date(req.query.from);
      to = new Date(req.query.to);
      if (isNaN(from) || isNaN(to)) {
        return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
      }
      to.setHours(23, 59, 59, 999);
    } else {
      to = new Date();
      from = new Date();
      from.setDate(from.getDate() - 90);
    }

    const snapshots = await ValueSnapshot.find(
      buildUserQuery({ createdAt: { $gte: from, $lte: to } }, req)
    ).sort({ createdAt: 1 });

    res.json({ snapshots, earliest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create an on-demand collection value snapshot
app.post('/api/value-snapshot', requireAuth, async (req, res) => {
  try {
    const cards = await Card.find(buildUserQuery({}, req));
    const totalValue = cards.reduce((sum, card) => sum + ((card.price || 0) * card.quantity), 0);

    const snapshot = await CardValueSnapshot.create({
      userId: getUserId(req),
      totalValue,
      cardCount: cards.length
    });

    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ message: 'Error creating snapshot', error: err.message });
  }
});

// Get collection value history (default last 30 days)
app.get('/api/value-history', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const history = await CardValueSnapshot.find({
      userId: getUserId(req),
      date: { $gte: startDate }
    }).sort({ date: 1 }).lean();

    res.json(history);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching value history', error: err.message });
  }
});

// Get top price gainers and losers over last 30 days
app.get('/api/stats/price-changes', requireAuth, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const cardQuery = buildUserQuery({}, req);
    const cards = await Card.find(cardQuery).select('_id name scryfallId price');

    const results = [];
    for (const card of cards) {
      // Get earliest and latest snapshot in last 30 days
      const snapshots = await CardPriceSnapshot.find({
        cardId: card._id,
        createdAt: { $gte: thirtyDaysAgo }
      }).sort({ createdAt: 1 });

      if (snapshots.length < 2) continue;

      const oldPrice = snapshots[0].price;
      const newPrice = snapshots[snapshots.length - 1].price;
      if (oldPrice <= 0) continue;

      const changeAbs = newPrice - oldPrice;
      const changePct = (changeAbs / oldPrice) * 100;

      results.push({
        cardId: card._id,
        name: card.name,
        scryfallId: card.scryfallId,
        oldPrice,
        newPrice,
        changeAbs,
        changePct
      });
    }

    results.sort((a, b) => b.changePct - a.changePct);
    const gainers = results.filter(r => r.changePct > 0).slice(0, 5);
    const losers = results.filter(r => r.changePct < 0).slice(-5).reverse();

    res.json({ gainers, losers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Finance Tracking Endpoints

// Get portfolio finance summary (buylist/sell/collection values and spread)
app.get('/api/finance', requireAuth, async (req, res) => {
  try {
    const cards = await Card.find(buildUserQuery({}, req));

    const totalBuylistValue = cards.reduce((sum, card) => sum + ((card.buylistValue || 0) * card.quantity), 0);
    const totalSellValue = cards.reduce((sum, card) => sum + ((card.sellValue || 0) * card.quantity), 0);
    const totalCollectionValue = cards.reduce((sum, card) => sum + ((card.price || 0) * card.quantity), 0);

    res.json({
      buylistValue: totalBuylistValue,
      sellValue: totalSellValue,
      collectionValue: totalCollectionValue,
      spread: totalCollectionValue - totalBuylistValue
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching finance data', error: err.message });
  }
});

// Tag Management Endpoints

// Get all tags (combines tags from cards with Tag model metadata)
app.get('/api/tags', requireAuth, async (req, res) => {
  try {
    // Get all unique tags from cards (scoped to user)
    const cardQuery = buildUserQuery({}, req);
    const cards = await Card.find(cardQuery);
    const cardTags = new Set();
    cards.forEach(card => {
      if (card.tags) {
        card.tags.forEach(tag => cardTags.add(tag));
      }
    });

    // Get all Tag documents (for metadata like ignorePrice) scoped to user
    const tagQuery = buildUserQuery({}, req);
    const tagDocs = await Tag.find(tagQuery);
    const tagDocMap = {};
    tagDocs.forEach(t => {
      tagDocMap[t.name] = t;
    });

    // Merge: include all tags from cards, with metadata from Tag model if exists
    const allTagNames = new Set([...cardTags, ...tagDocs.map(t => t.name)]);
    const result = Array.from(allTagNames).sort().map(name => ({
      name,
      ignorePrice: tagDocMap[name]?.ignorePrice || false,
      _id: tagDocMap[name]?._id || null
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new tag
app.post('/api/tags', requireAuth, requireEditor, activityLoggers.tagCreate, async (req, res) => {
  try {
    const { name, ignorePrice } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Tag name is required' });
    }

    const normalizedTag = name.trim().toLowerCase();
    const userId = getUserId(req);

    // Check if tag already exists in Tag model (scoped to user)
    const existingQuery = buildUserQuery({ name: normalizedTag }, req);
    const existingTag = await Tag.findOne(existingQuery);
    if (existingTag) {
      return res.status(400).json({ message: 'Tag already exists' });
    }

    // Create Tag document
    const tagData = {
      name: normalizedTag,
      ignorePrice: ignorePrice || false
    };
    if (userId) tagData.userId = userId;
    const tag = new Tag(tagData);
    const newTag = await tag.save();

    res.status(201).json(newTag);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Tag already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update a tag (e.g., toggle ignorePrice)
app.put('/api/tags/:name', requireAuth, requireEditor, activityLoggers.tagUpdate, async (req, res) => {
  try {
    const tagName = decodeURIComponent(req.params.name).toLowerCase();
    const { ignorePrice } = req.body;
    const userId = getUserId(req);

    // Find or create the tag document (scoped to user)
    const query = buildUserQuery({ name: tagName }, req);
    let tag = await Tag.findOne(query);
    if (!tag) {
      const tagData = { name: tagName, ignorePrice: ignorePrice || false };
      if (userId) tagData.userId = userId;
      tag = new Tag(tagData);
    } else {
      if (ignorePrice !== undefined) tag.ignorePrice = ignorePrice;
    }

    const updatedTag = await tag.save();
    res.json(updatedTag);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a tag (removes from all cards and deletes Tag document)
app.delete('/api/tags/:name', requireAuth, requireEditor, activityLoggers.tagDelete, async (req, res) => {
  try {
    const tagName = decodeURIComponent(req.params.name).toLowerCase();

    // Remove tag from all cards that have it (scoped to user)
    const cardQuery = buildUserQuery({ tags: tagName }, req);
    const result = await Card.updateMany(
      cardQuery,
      { $pull: { tags: tagName } }
    );

    // Delete the Tag document if it exists (scoped to user)
    const tagQuery = buildUserQuery({ name: tagName }, req);
    await Tag.deleteOne(tagQuery);

    res.json({
      message: `Tag "${tagName}" removed from ${result.modifiedCount} card(s)`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Serve cached images
app.get('/api/images/:scryfallId', (req, res) => {
  const { scryfallId } = req.params;
  const filepath = path.join(CACHE_DIR, `${scryfallId}.jpg`);

  // Check if file exists
  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ message: 'Image not found in cache' });
  }

  // Handle conditional requests - browser already has this immutable image
  if (req.headers['if-none-match'] === scryfallId) {
    return res.status(304).end();
  }

  // Serve image with aggressive cache headers
  res.set({
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'ETag': scryfallId
  });

  const stream = fs.createReadStream(filepath);
  stream.pipe(res);
});

// ============================================
// LOCATION ROUTES
// ============================================

// Get all locations
app.get('/api/locations', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({}, req);
    const locations = await Location.find(query).sort({ name: 1 });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new location
app.post('/api/locations', requireAuth, requireEditor, activityLoggers.locationCreate, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Location name is required' });
    }

    const userId = getUserId(req);
    const locationData = {
      name: name.trim(),
      description: description || ''
    };
    if (userId) locationData.userId = userId;

    const location = new Location(locationData);
    const newLocation = await location.save();
    res.status(201).json(newLocation);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Location name already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update location
app.put('/api/locations/:id', requireAuth, requireEditor, activityLoggers.locationUpdate, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const location = await Location.findOne(query);
    if (!location) return res.status(404).json({ message: 'Location not found' });

    const { name, description, ignorePrice } = req.body;
    if (name) location.name = name.trim();
    if (description !== undefined) location.description = description;
    if (ignorePrice !== undefined) location.ignorePrice = ignorePrice;

    const updatedLocation = await location.save();
    res.json(updatedLocation);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Location name already exists' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Delete location (only if no cards are using it)
app.delete('/api/locations/:id', requireAuth, requireEditor, activityLoggers.locationDelete, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const location = await Location.findOne(query);
    if (!location) return res.status(404).json({ message: 'Location not found' });

    // Check if any cards are using this location (scoped to user)
    const cardQuery = buildUserQuery({ location: location.name }, req);
    const cardsUsingLocation = await Card.countDocuments(cardQuery);
    if (cardsUsingLocation > 0) {
      return res.status(400).json({
        message: `Cannot delete location. ${cardsUsingLocation} card(s) are using it.`,
        cardsCount: cardsUsingLocation
      });
    }

    await location.deleteOne();
    res.json({ message: 'Location deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// WISHLIST ROUTES
// ============================================

// Get all wishlist items
app.get('/api/wishlist', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({}, req);
    // priority is a string enum ('low'/'medium'/'high'); sort by actual rank,
    // not alphabetically (a plain Mongo sort would put "medium" before "high").
    const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
    const items = (await WishlistItem.find(query).lean()).sort(
      (a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) || a.name.localeCompare(b.name)
    );
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add to wishlist
app.post('/api/wishlist', requireAuth, requireEditor, activityLoggers.wishlistAdd, async (req, res) => {
  try {
    const userId = getUserId(req);
    const itemData = { ...req.body };
    if (userId) itemData.userId = userId;
    const item = new WishlistItem(itemData);
    const newItem = await item.save();
    res.status(201).json(newItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update wishlist item
app.put('/api/wishlist/:id', requireAuth, requireEditor, activityLoggers.wishlistUpdate, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const item = await WishlistItem.findOne(query);
    if (!item) return res.status(404).json({ message: 'Wishlist item not found' });

    const { userId: _, ...updateData } = req.body;
    Object.assign(item, updateData);
    const updatedItem = await item.save();
    res.json(updatedItem);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete wishlist item
app.delete('/api/wishlist/:id', requireAuth, requireEditor, activityLoggers.wishlistDelete, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const item = await WishlistItem.findOne(query);
    if (!item) return res.status(404).json({ message: 'Wishlist item not found' });

    await item.deleteOne();
    res.json({ message: 'Wishlist item deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Acquire wishlist item (move to collection)
app.post('/api/wishlist/:id/acquire', requireAuth, requireEditor, activityLoggers.wishlistAcquire, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const item = await WishlistItem.findOne(query);
    if (!item) return res.status(404).json({ message: 'Wishlist item not found' });

    const { location } = req.body; // Optional location to store the acquired card
    const userId = getUserId(req);

    // Check if card already exists in collection (scoped to user)
    const cardQuery = buildUserQuery({
      name: item.name,
      set: item.set || 'Unknown',
      condition: item.condition || 'NM',
      isFoil: false
    }, req);
    const existingCard = await Card.findOne(cardQuery);

    if (existingCard) {
      // Merge with existing card
      existingCard.quantity += item.quantity || 1;
      if (location) existingCard.location = location;
      await existingCard.save();

      // Remove from wishlist
      await item.deleteOne();

      return res.json({
        merged: true,
        message: `Merged with existing card. New quantity: ${existingCard.quantity}`,
        card: existingCard
      });
    }

    // Create new card in collection
    const newCardData = {
      name: item.name,
      set: item.set || 'Unknown',
      setCode: item.setCode || '',
      collectorNumber: '',
      rarity: item.rarity || '',
      quantity: item.quantity || 1,
      condition: item.condition || 'NM',
      price: item.currentPrice || 0,
      colors: item.colors || [],
      types: item.types || [],
      manaCost: item.manaCost || '',
      scryfallId: item.scryfallId || '',
      imageUrl: item.imageUrl || '',
      isFoil: false,
      isToken: false,
      oracleText: item.oracleText || '',
      tags: [],
      location: location || ''
    };
    if (userId) newCardData.userId = userId;
    const newCard = new Card(newCardData);

    await newCard.save();

    // Remove from wishlist
    await item.deleteOne();

    res.json({
      merged: false,
      message: 'Card added to collection',
      card: newCard
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk update wishlist prices
app.post('/api/wishlist/update-all-prices', requireAuth, requireEditor, async (req, res) => {
  try {
    const wishlistQuery = buildUserQuery({}, req);
    const items = await WishlistItem.find(wishlistQuery);
    let updated = 0;

    for (const item of items) {
      try {
        const priceData = await getPriceWithFallback(item.name);
        item.currentPrice = priceData.usd > 0 ? priceData.usd : item.currentPrice;
        await item.save();
        updated++;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error updating price for ${item.name}:`, error.message);
      }
    }

    res.json({
      message: `Updated ${updated} of ${items.length} wishlist items`,
      updated,
      total: items.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// IMAGE MATCHING ROUTES (Perceptual Hashing)
// ============================================

// Cache for image hashes
let imageHashCache = {
  hashes: new Map(), // scryfallId -> { hash, cardName }
  lastBuild: 0,
  isBuilding: false
};

// Compute perceptual hash (average hash) of an image
async function computeImageHash(imageBuffer) {
  if (!sharp) {
    throw new Error('Sharp not available');
  }

  try {
    // Resize to 8x8 grayscale
    const { data } = await sharp(imageBuffer)
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Calculate average pixel value
    const pixels = [...data];
    const avg = pixels.reduce((sum, val) => sum + val, 0) / pixels.length;

    // Generate hash: 1 if pixel > average, 0 otherwise
    let hash = '';
    for (const pixel of pixels) {
      hash += pixel > avg ? '1' : '0';
    }

    return hash;
  } catch (error) {
    console.error('Error computing hash:', error);
    throw error;
  }
}

// Calculate Hamming distance between two hashes
function hammingDistance(hash1, hash2) {
  if (hash1.length !== hash2.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

// Build hash index from cached images
async function buildHashIndex() {
  if (!sharp) {
    console.log('Cannot build hash index: sharp not available');
    return { count: 0, error: 'sharp not available' };
  }

  if (imageHashCache.isBuilding) {
    return { count: imageHashCache.hashes.size, status: 'already building' };
  }

  imageHashCache.isBuilding = true;
  console.log('Building image hash index...');

  try {
    // Get all cards with scryfallIds
    const cards = await Card.find({ scryfallId: { $exists: true, $ne: null } });
    let processed = 0;
    let errors = 0;

    for (const card of cards) {
      const imagePath = path.join(CACHE_DIR, `${card.scryfallId}.jpg`);

      if (fs.existsSync(imagePath)) {
        try {
          const imageBuffer = fs.readFileSync(imagePath);
          const hash = await computeImageHash(imageBuffer);
          imageHashCache.hashes.set(card.scryfallId, {
            hash,
            cardName: card.name,
            setCode: card.setCode
          });
          processed++;
        } catch (e) {
          errors++;
        }
      }
    }

    imageHashCache.lastBuild = Date.now();
    console.log(`Hash index built: ${processed} images, ${errors} errors`);

    return { count: processed, errors };
  } finally {
    imageHashCache.isBuilding = false;
  }
}

// Match an image against cached images
app.post('/api/image-match', requireAuth, express.json({ limit: '10mb' }), async (req, res) => {
  if (!sharp) {
    return res.status(503).json({
      message: 'Image matching not available (sharp not installed)',
      matches: []
    });
  }

  try {
    const { imageData } = req.body; // Base64 image data

    if (!imageData) {
      return res.status(400).json({ message: 'No image data provided' });
    }

    // Build index if empty or stale (older than 1 hour)
    if (imageHashCache.hashes.size === 0 ||
        Date.now() - imageHashCache.lastBuild > 3600000) {
      await buildHashIndex();
    }

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Compute hash of uploaded image
    const uploadedHash = await computeImageHash(imageBuffer);

    // Find matches by Hamming distance
    const matches = [];
    const THRESHOLD = 15; // Max hamming distance for a match (out of 64 bits)

    for (const [scryfallId, data] of imageHashCache.hashes) {
      const distance = hammingDistance(uploadedHash, data.hash);
      if (distance <= THRESHOLD) {
        matches.push({
          scryfallId,
          cardName: data.cardName,
          setCode: data.setCode,
          distance,
          confidence: Math.round((1 - distance / 64) * 100)
        });
      }
    }

    // Sort by distance (best matches first)
    matches.sort((a, b) => a.distance - b.distance);

    res.json({
      matches: matches.slice(0, 5), // Return top 5 matches
      hashesIndexed: imageHashCache.hashes.size,
      uploadedHash: uploadedHash.substring(0, 16) + '...' // First 16 bits for debugging
    });

  } catch (error) {
    console.error('Image match error:', error);
    res.status(500).json({
      message: 'Image matching failed',
      error: error.message,
      matches: []
    });
  }
});

// Build/rebuild the hash index
app.post('/api/image-match/build-index', requireAuth, requireEditor, async (req, res) => {
  if (!sharp) {
    return res.status(503).json({ message: 'Sharp not installed' });
  }

  try {
    const result = await buildHashIndex();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get index status
app.get('/api/image-match/status', requireAuth, (req, res) => {
  res.json({
    available: !!sharp,
    indexedImages: imageHashCache.hashes.size,
    lastBuild: imageHashCache.lastBuild,
    isBuilding: imageHashCache.isBuilding
  });
});

// ============================================
// COMBO FINDER ROUTES
// ============================================

// Cache for Commander Spellbook data (refresh every hour)
let comboCache = {
  data: null,
  timestamp: 0,
  CACHE_DURATION: 60 * 60 * 1000 // 1 hour
};

// Format the produces field from Commander Spellbook
function formatProduces(produces) {
  if (!produces || !Array.isArray(produces)) return [];

  return produces.map(p => {
    if (typeof p === 'string') return p;
    if (p.feature && p.feature.name) return p.feature.name;
    if (p.name) return p.name;
    if (p.description) return p.description;
    return null;
  }).filter(Boolean);
}

// Fetch combos from Commander Spellbook API
async function fetchCommanderSpellbookCombos() {
  const now = Date.now();

  // Return cached data if still valid
  if (comboCache.data && (now - comboCache.timestamp) < comboCache.CACHE_DURATION) {
    console.log('Using cached Commander Spellbook data');
    return comboCache.data;
  }

  console.log('Fetching fresh data from Commander Spellbook...');
  try {
    // Commander Spellbook API endpoint
    const response = await axios.get('https://backend.commanderspellbook.com/variants/', {
      timeout: 30000, // 30 second timeout
      headers: {
        'Accept': 'application/json'
      }
    });

    // Process and cache the data
    const combos = response.data.results || response.data || [];
    comboCache.data = combos;
    comboCache.timestamp = now;

    console.log(`Cached ${combos.length} combos from Commander Spellbook`);
    return combos;
  } catch (error) {
    console.error('Failed to fetch Commander Spellbook data:', error.message);
    // Return cached data if available, even if expired
    if (comboCache.data) {
      console.log('Returning stale cache due to API error');
      return comboCache.data;
    }
    throw error;
  }
}

// Find combos that can be assembled from the user's collection
app.get('/api/combos/find', requireAuth, async (req, res) => {
  try {
    // Get all cards in collection (scoped to user when multi-user enabled)
    const query = buildUserQuery({}, req);
    const cards = await Card.find(query);

    // Create a Set of card names (lowercase for case-insensitive matching)
    const collectionNames = new Set(
      cards.map(card => card.name.toLowerCase().trim())
    );

    // Also track which cards we have for display purposes
    const collectionMap = new Map();
    cards.forEach(card => {
      collectionMap.set(card.name.toLowerCase().trim(), card);
    });

    // Fetch combos from Commander Spellbook
    const allCombos = await fetchCommanderSpellbookCombos();

    // Find complete and partial combos
    const completeCombos = [];
    const partialCombos = [];

    for (const combo of allCombos) {
      // Get card names used in this combo
      // Commander Spellbook format: combo.uses contains card objects with card.name
      let comboCards = [];

      if (combo.uses && Array.isArray(combo.uses)) {
        // New API format: uses is array of objects with card property
        comboCards = combo.uses.map(use => {
          if (use.card && use.card.name) return use.card.name;
          if (use.name) return use.name;
          if (typeof use === 'string') return use;
          return null;
        }).filter(Boolean);
      } else if (combo.cards && Array.isArray(combo.cards)) {
        // Alternative format
        comboCards = combo.cards.map(c => c.name || c).filter(Boolean);
      }

      if (comboCards.length === 0) continue;

      // Check if we own ALL cards in this combo
      const ownedCards = [];
      const missingCards = [];

      for (const cardName of comboCards) {
        const lowerName = cardName.toLowerCase().trim();
        if (collectionNames.has(lowerName)) {
          ownedCards.push({
            name: cardName,
            card: collectionMap.get(lowerName)
          });
        } else {
          missingCards.push(cardName);
        }
      }

      // Complete combos (own all cards)
      if (missingCards.length === 0 && ownedCards.length > 0) {
        completeCombos.push({
          id: combo.id || combo._id,
          cards: comboCards,
          ownedCards: ownedCards,
          missingCards: [],
          produces: formatProduces(combo.produces || combo.result || []),
          description: combo.description || combo.explanation || '',
          colorIdentity: combo.color_identity || combo.colorIdentity || [],
          prerequisite: combo.prerequisite || combo.prerequisites || '',
          steps: combo.steps || combo.process || '',
          spellbookUrl: combo.id ? `https://commanderspellbook.com/combo/${combo.id}` : null,
          isComplete: true
        });
      }
      // Partial combos (missing 1-2 cards, own at least 2)
      else if (missingCards.length <= 2 && ownedCards.length >= 2) {
        partialCombos.push({
          id: combo.id || combo._id,
          cards: comboCards,
          ownedCards: ownedCards,
          missingCards: missingCards,
          produces: formatProduces(combo.produces || combo.result || []),
          description: combo.description || combo.explanation || '',
          colorIdentity: combo.color_identity || combo.colorIdentity || [],
          prerequisite: combo.prerequisite || combo.prerequisites || '',
          steps: combo.steps || combo.process || '',
          spellbookUrl: combo.id ? `https://commanderspellbook.com/combo/${combo.id}` : null,
          isComplete: false
        });
      }
    }

    // Sort by number of cards (simpler combos first)
    completeCombos.sort((a, b) => a.cards.length - b.cards.length);
    // Sort partial by fewest missing cards first
    partialCombos.sort((a, b) => a.missingCards.length - b.missingCards.length || a.cards.length - b.cards.length);

    res.json({
      found: completeCombos.length,
      partialFound: partialCombos.length,
      totalCombosSearched: allCombos.length,
      collectionSize: cards.length,
      combos: completeCombos,
      partialCombos: partialCombos.slice(0, 50) // Limit to 50 partial combos
    });

  } catch (error) {
    console.error('Combo finder error:', error);
    res.status(500).json({
      message: 'Failed to find combos',
      error: error.message
    });
  }
});

// Get combo suggestions for a specific card
app.get('/api/combos/for-card/:cardName', requireAuth, async (req, res) => {
  try {
    const cardName = decodeURIComponent(req.params.cardName).toLowerCase().trim();

    // Fetch combos from Commander Spellbook
    const allCombos = await fetchCommanderSpellbookCombos();

    // Find combos that include this card
    const relevantCombos = [];

    for (const combo of allCombos) {
      let comboCards = [];

      if (combo.uses && Array.isArray(combo.uses)) {
        comboCards = combo.uses.map(use => {
          if (use.card && use.card.name) return use.card.name;
          if (use.name) return use.name;
          if (typeof use === 'string') return use;
          return null;
        }).filter(Boolean);
      } else if (combo.cards && Array.isArray(combo.cards)) {
        comboCards = combo.cards.map(c => c.name || c).filter(Boolean);
      }

      // Check if this combo includes our card
      const includesCard = comboCards.some(c =>
        c.toLowerCase().trim() === cardName
      );

      if (includesCard) {
        relevantCombos.push({
          id: combo.id || combo._id,
          cards: comboCards,
          produces: formatProduces(combo.produces || combo.result || []),
          description: combo.description || combo.explanation || '',
          colorIdentity: combo.color_identity || combo.colorIdentity || [],
          prerequisite: combo.prerequisite || combo.prerequisites || '',
          steps: combo.steps || combo.process || '',
          spellbookUrl: combo.id ? `https://commanderspellbook.com/combo/${combo.id}` : null
        });
      }
    }

    res.json({
      card: cardName,
      found: relevantCombos.length,
      combos: relevantCombos.slice(0, 50) // Limit to 50 results
    });

  } catch (error) {
    console.error('Combo lookup error:', error);
    res.status(500).json({
      message: 'Failed to find combos for card',
      error: error.message
    });
  }
});

// ============================================
// LIFE COUNTER ROUTES
// ============================================

// Get all player profiles
app.get('/api/lifecounter/profiles', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({}, req);
    const profiles = await PlayerProfile.find(query).sort({ name: 1 });
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new player profile
app.post('/api/lifecounter/profiles', requireAuth, requireEditor, async (req, res) => {
  try {
    const { name, avatarColor, backgroundImage, backgroundType, commanderName } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Profile name is required' });
    }

    const profile = new PlayerProfile({
      userId: getUserId(req),
      name: name.trim(),
      avatarColor: avatarColor || '#6366f1',
      backgroundImage: backgroundImage || '',
      backgroundType: backgroundType || 'none',
      commanderName: commanderName || ''
    });

    const newProfile = await profile.save();
    res.status(201).json(newProfile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update player profile
app.put('/api/lifecounter/profiles/:id', requireAuth, requireEditor, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const profile = await PlayerProfile.findOne(query);
    if (!profile) return res.status(404).json({ message: 'Profile not found' });

    const { name, avatarColor, backgroundImage, backgroundType, commanderName } = req.body;
    if (name) profile.name = name.trim();
    if (avatarColor) profile.avatarColor = avatarColor;
    if (backgroundImage !== undefined) profile.backgroundImage = backgroundImage;
    if (backgroundType !== undefined) profile.backgroundType = backgroundType;
    if (commanderName !== undefined) profile.commanderName = commanderName;

    const updatedProfile = await profile.save();
    res.json(updatedProfile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete player profile
app.delete('/api/lifecounter/profiles/:id', requireAuth, requireEditor, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const profile = await PlayerProfile.findOne(query);
    if (!profile) return res.status(404).json({ message: 'Profile not found' });

    await profile.deleteOne();
    res.json({ message: 'Profile deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save completed game
app.post('/api/lifecounter/games', requireAuth, async (req, res) => {
  try {
    const gameSession = new GameSession({ ...req.body, userId: getUserId(req) });
    const savedSession = await gameSession.save();
    res.status(201).json(savedSession);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get game history
app.get('/api/lifecounter/games', requireAuth, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const query = buildUserQuery({}, req);
    const games = await GameSession.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    res.json(games);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get game statistics
app.get('/api/lifecounter/stats', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({}, req);
    const games = await GameSession.find(query);

    // Calculate statistics
    const totalGames = games.length;
    const winsByPlayer = {};
    const gamesByFormat = {};
    let totalTurns = 0;
    let totalDuration = 0;
    let gamesWithTurns = 0;
    let gamesWithDuration = 0;

    games.forEach(game => {
      // Track wins
      if (game.winner) {
        winsByPlayer[game.winner] = (winsByPlayer[game.winner] || 0) + 1;
      }

      // Track formats
      const format = game.format || 'commander';
      gamesByFormat[format] = (gamesByFormat[format] || 0) + 1;

      // Track turns
      if (game.turns > 0) {
        totalTurns += game.turns;
        gamesWithTurns++;
      }

      // Track duration
      if (game.duration > 0) {
        totalDuration += game.duration;
        gamesWithDuration++;
      }
    });

    // Calculate win rates
    const winRates = {};
    Object.keys(winsByPlayer).forEach(player => {
      const gamesPlayed = games.filter(g =>
        g.players.some(p => p.name === player)
      ).length;
      winRates[player] = {
        wins: winsByPlayer[player],
        gamesPlayed,
        winRate: gamesPlayed > 0 ? Math.round((winsByPlayer[player] / gamesPlayed) * 100) : 0
      };
    });

    // Most played decks (by deckId)
    const deckPlayCounts = {};
    games.forEach(game => {
      game.players.forEach(p => {
        if (p.deckId) {
          const key = p.deckId.toString();
          if (!deckPlayCounts[key]) {
            deckPlayCounts[key] = { deckId: p.deckId, commanderName: p.commanderName || '', gamesPlayed: 0, wins: 0 };
          }
          deckPlayCounts[key].gamesPlayed++;
          if (p.isWinner) deckPlayCounts[key].wins++;
        }
      });
    });
    const mostPlayedDecks = Object.values(deckPlayCounts)
      .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
      .slice(0, 5)
      .map(d => ({
        ...d,
        winRate: d.gamesPlayed > 0 ? Math.round((d.wins / d.gamesPlayed) * 100) : 0
      }));

    res.json({
      totalGames,
      winsByPlayer,
      winRates,
      gamesByFormat,
      averageTurns: gamesWithTurns > 0 ? Math.round(totalTurns / gamesWithTurns) : 0,
      averageDuration: gamesWithDuration > 0 ? Math.round(totalDuration / gamesWithDuration) : 0,
      mostPlayedDecks
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Generate share link for current game state
app.post('/api/lifecounter/share', requireAuth, async (req, res) => {
  try {
    const { gameState } = req.body;
    if (!gameState) {
      return res.status(400).json({ message: 'Game state is required' });
    }

    // Generate a random 8-character code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();

    const sharedGame = new SharedGame({
      code,
      gameState
    });

    await sharedGame.save();

    res.status(201).json({
      code,
      message: 'Game shared successfully. Link expires in 24 hours.'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Load shared game state
app.get('/api/lifecounter/share/:code', async (req, res) => {
  try {
    const sharedGame = await SharedGame.findOne({ code: req.params.code });
    if (!sharedGame) {
      return res.status(404).json({ message: 'Shared game not found or expired' });
    }

    res.json(sharedGame.gameState);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get card rulings from Scryfall
app.get('/api/scryfall/rulings', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ message: 'Card name (q) is required' });
    }

    // First, find the card by name to get its Scryfall ID
    const cardResponse = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(q)}`);
    const cardId = cardResponse.data.id;

    // Then fetch the rulings for that card
    const rulingsResponse = await axios.get(`https://api.scryfall.com/cards/${cardId}/rulings`);
    const rulings = rulingsResponse.data.data;

    res.json(rulings);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      res.status(404).json({ message: 'Card not found on Scryfall' });
    } else {
      console.error('Error fetching rulings:', error.message);
      res.status(500).json({ message: error.message });
    }
  }
});

// POST /api/interactions/check â€” fetch real card data and rulings from Scryfall
app.post('/api/interactions/check', async (req, res) => {
  try {
    const { card1, card2 } = req.body;

    if (!card1 || !card2) {
      return res.status(400).json({ message: 'Both card1 and card2 are required' });
    }

    const scryfallCard = async (name) => {
      const r = await axios.get('https://api.scryfall.com/cards/named', {
        params: { fuzzy: name },
        timeout: 8000
      });
      return r.data;
    };

    const scryfallRulings = async (cardId) => {
      const r = await axios.get(`https://api.scryfall.com/cards/${cardId}/rulings`, {
        timeout: 8000
      });
      return r.data.data || [];
    };

    const [c1, c2] = await Promise.all([scryfallCard(card1), scryfallCard(card2)]);
    const [rulings1, rulings2] = await Promise.all([
      scryfallRulings(c1.id),
      scryfallRulings(c2.id)
    ]);

    // Find shared keywords (case-insensitive intersection)
    const kw1 = new Set((c1.keywords || []).map(k => k.toLowerCase()));
    const kw2 = new Set((c2.keywords || []).map(k => k.toLowerCase()));
    const sharedKeywords = [...kw1].filter(k => kw2.has(k));

    // Also scan oracle text for MTG terms that appear in both cards
    const oracleWords = (text) =>
      (text || '').toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const words1 = new Set(oracleWords(c1.oracle_text));
    const words2 = new Set(oracleWords(c2.oracle_text));
    const MTG_TERMS = new Set([
      'flying','lifelink','deathtouch','vigilance','trample','haste',
      'hexproof','indestructible','menace','reach','flash','defender',
      'sacrifice','discard','counter','exile','destroy','enchant','equip','create',
      'token','trigger','activated','graveyard','library','battlefield','hand',
      'enters','leaves','dies','draw','search','shuffle','return','target','choose',
      'proliferate','convoke','delve','annihilator','infect','wither','undying','persist'
    ]);
    const sharedOracleTerms = [...words1]
      .filter(w => words2.has(w) && MTG_TERMS.has(w) && !sharedKeywords.includes(w));

    const allShared = [...new Set([...sharedKeywords, ...sharedOracleTerms])];

    res.json({
      card1: {
        name: c1.name,
        oracle_text: c1.oracle_text || '',
        keywords: c1.keywords || [],
        type_line: c1.type_line || '',
        image_uri: c1.image_uris?.normal || c1.card_faces?.[0]?.image_uris?.normal || null,
        mana_cost: c1.mana_cost || '',
      },
      card2: {
        name: c2.name,
        oracle_text: c2.oracle_text || '',
        keywords: c2.keywords || [],
        type_line: c2.type_line || '',
        image_uri: c2.image_uris?.normal || c2.card_faces?.[0]?.image_uris?.normal || null,
        mana_cost: c2.mana_cost || '',
      },
      rulings1,
      rulings2,
      sharedKeywords: allShared,
    });
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'One or both card names not found on Scryfall. Check spelling.' });
    }
    console.error('Interaction check error:', error.message);
    res.status(500).json({ message: 'Failed to fetch card data from Scryfall' });
  }
});

// GET /api/user/column-preferences - fetch user's visible columns
app.get('/api/user/column-preferences', verifyToken, requireAuth, async (req, res) => {
  try {
    let prefs = await UserColumnPreferences.findOne({ userId: req.user._id });

    if (!prefs) {
      prefs = await UserColumnPreferences.create({
        userId: req.user._id,
        visibleColumns: ['cardName', 'quantity', 'condition', 'price']
      });
    }

    res.json({ visibleColumns: prefs.visibleColumns });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch column preferences', error: err.message });
  }
});

// PUT /api/user/column-preferences - update visible columns
app.put('/api/user/column-preferences', verifyToken, requireAuth, async (req, res) => {
  try {
    const { visibleColumns } = req.body;

    if (!Array.isArray(visibleColumns) || visibleColumns.length === 0) {
      return res.status(400).json({ message: 'visibleColumns must be a non-empty array' });
    }

    let prefs = await UserColumnPreferences.findOne({ userId: req.user._id });

    if (!prefs) {
      prefs = await UserColumnPreferences.create({
        userId: req.user._id,
        visibleColumns
      });
    } else {
      prefs.visibleColumns = visibleColumns;
      await prefs.save();
    }

    res.json({ visibleColumns: prefs.visibleColumns });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update column preferences', error: err.message });
  }
});

// GET /api/admin/collection-audit/:userId - audit a user's collection
app.get('/api/admin/collection-audit/:userId', verifyToken, requireAuth, requirePermission('cards:audit'), async (req, res) => {
  try {
    const cards = await Card.find({ userId: req.params.userId });
    const duplicates = cards.filter((card, index, self) =>
      self.findIndex(c => c.name === card.name && c.set === card.set) !== index
    );

    const audit = {
      totalCards: cards.length,
      totalValue: cards.reduce((sum, c) => sum + (c.price * c.quantity), 0),
      duplicates: duplicates.length,
      missingPrices: cards.filter(c => !c.price).length,
      missingImages: cards.filter(c => !c.imageUrl).length
    };

    res.json(audit);
  } catch (err) {
    res.status(500).json({ message: 'Error auditing collection', error: err.message });
  }
});

// Automatic daily collection value snapshot for every user
setInterval(async () => {
  try {
    const users = await User.find({});
    for (const user of users) {
      const cards = await Card.find({ userId: user._id });
      const totalValue = cards.reduce((sum, card) => sum + ((card.price || 0) * card.quantity), 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existing = await CardValueSnapshot.findOne({
        userId: user._id,
        date: { $gte: today }
      });

      if (!existing) {
        await CardValueSnapshot.create({
          userId: user._id,
          totalValue,
          cardCount: cards.length
        });
      }
    }
  } catch (err) {
    console.error('Error creating value snapshots:', err);
  }
}, 24 * 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

registerDailySnapshotJob();
registerWeeklyHealthReportJob();
registerSetReleaseAnnouncerJob();
