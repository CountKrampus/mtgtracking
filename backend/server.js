require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const deckRoutes = require('./routes/decks');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');
const { isMultiUserEnabled, verifyToken, requireAuth, requireEditor, checkMaintenanceMode } = require('./middleware/auth');
const { buildUserQuery, getUserId } = require('./middleware/multiUser');
const { activityLoggers } = require('./middleware/activityLogger');
const SystemSettings = require('./models/SystemSettings');

// Try to load sharp for image hashing (optional dependency)
let sharp = null;
try {
  sharp = require('sharp');
  console.log('Sharp loaded successfully - image matching enabled');
} catch (e) {
  console.log('Sharp not available - image matching disabled. Run: npm install sharp');
}

// Create cache directory if it doesn't exist
const CACHE_DIR = path.join(__dirname, 'cached-images');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log('Image cache directory created:', CACHE_DIR);
}

const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

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
})
.catch(err => console.error('MongoDB connection error:', err));

// Auth middleware - verify token for all requests (populates req.user if valid token)
app.use(verifyToken);

// Mount auth routes (these don't require authentication)
app.use('/api/auth', authRoutes);

// Mount user routes (require authentication)
app.use('/api/users', userRoutes);

// Mount admin routes (require admin role)
app.use('/api/admin', adminRoutes);

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
    color: String
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

// API Response Cache Schema (24-hour TTL)
const apiCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete after 24 hours
});

const ApiCache = mongoose.model('ApiCache', apiCacheSchema);

// Cached API call helper
async function cachedApiCall(key, fetchFn) {
  try {
    const cached = await ApiCache.findOne({ key });
    if (cached) return cached.data;
  } catch {
    // Cache miss or error, proceed to fetch
  }

  const data = await fetchFn();

  try {
    await ApiCache.findOneAndUpdate(
      { key },
      { key, data, createdAt: new Date() },
      { upsert: true, new: true }
    );
  } catch {
    // Cache write failure is non-critical
  }

  return data;
}

cardSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Card = mongoose.model('Card', cardSchema);

// Helper Functions

// Parse card line to extract name, quantity, and metadata (set code, collector number, rarity)
// Supports formats:
// - "Lightning Bolt" (plain name)
// - "Lightning Bolt (M10)" (set code only)
// - "Lightning Bolt (M10) 146" (set code + collector number)
// - "Lightning Bolt (U 146 M10)" (rarity + collector number + set code)
// - "4 Lightning Bolt" (quantity prefix for any format)
function parseCardLine(line) {
  // Parse quantity (e.g., "4 Lightning Bolt" -> quantity: 4, rest: "Lightning Bolt")
  const qtyMatch = line.trim().match(/^(\d+)\s+(.+)$/);
  let quantity = 1;
  let rest = line.trim();

  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1]);
    rest = qtyMatch[2];
  }

  // Initialize result
  const result = {
    cardName: rest,
    quantity: quantity,
    setCode: null,
    collectorNumber: null,
    rarity: null
  };

  // Try to match format: (R 0226 LCI) - full format with rarity
  const fullMatch = rest.match(/^(.+?)\s*\(([CURMLS])\s+(\d+)\s+([A-Z0-9]+)\)\s*$/i);
  if (fullMatch) {
    result.cardName = fullMatch[1].trim();
    result.rarity = fullMatch[2].toUpperCase();
    result.collectorNumber = fullMatch[3];
    result.setCode = fullMatch[4].toUpperCase();
    return result;
  }

  // Try to match format: (LCI) 0226 - set code + collector number
  const setCollectorMatch = rest.match(/^(.+?)\s*\(([A-Z0-9]+)\)\s+([A-Z0-9\-]+)\s*$/i);
  if (setCollectorMatch) {
    result.cardName = setCollectorMatch[1].trim();
    result.setCode = setCollectorMatch[2].toUpperCase();
    result.collectorNumber = setCollectorMatch[3];
    return result;
  }

  // Try to match format: (LCI) - set code only
  const setOnlyMatch = rest.match(/^(.+?)\s*\(([A-Z0-9]+)\)\s*$/i);
  if (setOnlyMatch) {
    result.cardName = setOnlyMatch[1].trim();
    result.setCode = setOnlyMatch[2].toUpperCase();
    return result;
  }

  // No metadata found - plain card name
  return result;
}

// Fetch card data from Scryfall with exact collector number lookup and fallback to fuzzy search
// Priority: exact (set+collector) > fuzzy with set > fuzzy name-only
async function fetchCardFromScryfall(cardName, setCode, collectorNumber) {
  let cardData = null;
  let lookupMethod = 'fuzzy';

  // Method 1: Exact lookup by set + collector number (most precise)
  if (setCode && collectorNumber) {
    try {
      const response = await axios.get(
        `https://api.scryfall.com/cards/${setCode.toLowerCase()}/${collectorNumber}`
      );
      cardData = response.data;
      lookupMethod = 'exact';
      console.log(`✓ Exact match: ${cardName} (${setCode} ${collectorNumber})`);
    } catch (error) {
      console.log(`Exact lookup failed for ${setCode}/${collectorNumber}, trying fuzzy...`);
    }
  }

  // Method 2: Fuzzy search by name + set code
  if (!cardData && setCode) {
    try {
      const response = await axios.get(
        `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}&set=${setCode.toLowerCase()}`
      );
      cardData = response.data;
      lookupMethod = 'fuzzy-with-set';
      console.log(`✓ Fuzzy match with set: ${cardName} (${setCode})`);
    } catch (error) {
      console.log(`Fuzzy with set failed, trying name-only fuzzy...`);
    }
  }

  // Method 3: Fuzzy search by name only (fallback)
  if (!cardData) {
    const response = await axios.get(
      `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`
    );
    cardData = response.data;
    lookupMethod = 'fuzzy-name-only';
    console.log(`✓ Fuzzy match (name only): ${cardName}`);
  }

  return {
    cardData,
    lookupMethod
  };
}

// Routes

// Get all cards
app.get('/api/cards', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({}, req);
    const cards = await Card.find(query).sort({ name: 1 });
    res.json(cards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single card
app.get('/api/cards/:id', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });
    res.json(card);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

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

// Helper function to fetch price from Exor Games with Scryfall backup
async function getPriceWithFallback(cardName, isFoil = false) {
  // Try Exor Games first
  try {
    const searchUrl = `https://exorgames.com/a/search?type=product&q=${encodeURIComponent(cardName)}`;
    const response = await axios.get(searchUrl);
    const html = response.data;

    // Try to extract the first product's price
    const priceMatch = html.match(/"price":\s*(\d+)/);
    if (priceMatch) {
      const priceInCents = parseInt(priceMatch[1]);
      const priceCAD = priceInCents / 100;
      // Rough CAD to USD conversion (approximately 0.73)
      const priceUSD = Math.round(priceCAD * 0.73 * 100) / 100;

      if (priceUSD > 0) {
        return { cad: priceCAD, usd: priceUSD, source: 'Exor Games' };
      }
    }
  } catch (error) {
    console.error('Exor Games price fetch failed:', error.message);
  }

  // Fallback to Scryfall if Exor Games returns 0 or fails
  try {
    console.log('Falling back to Scryfall pricing for:', cardName);
    const response = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
    const scryfallPrice = isFoil
      ? (response.data.prices.usd_foil ? parseFloat(response.data.prices.usd_foil) : 0)
      : (response.data.prices.usd ? parseFloat(response.data.prices.usd) : 0);

    if (scryfallPrice > 0) {
      return { cad: 0, usd: scryfallPrice, source: 'Scryfall (backup)' };
    }
  } catch (error) {
    console.error('Scryfall price fetch failed:', error.message);
  }

  // If both fail, return 0
  return { cad: 0, usd: 0, source: 'None (not found)' };
}

// Download and cache image from Scryfall, return local path or fallback to URL
async function cacheCardImage(scryfallId, imageUrl) {
  if (!scryfallId || !imageUrl) {
    return null;
  }

  const filename = `${scryfallId}.jpg`;
  const filepath = path.join(CACHE_DIR, filename);
  const localUrl = `/api/images/${scryfallId}`;

  // Check if already cached
  if (fs.existsSync(filepath)) {
    console.log(`Image cache hit: ${scryfallId}`);
    return localUrl;
  }

  // Download and cache image
  try {
    console.log(`Downloading image: ${scryfallId}`);
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(filepath);
    await pipeline(response.data, writer);

    console.log(`Image cached successfully: ${scryfallId}`);
    return localUrl;
  } catch (error) {
    console.error(`Failed to cache image for ${scryfallId}:`, error.message);
    // Fallback to original Scryfall URL if caching fails
    return imageUrl;
  }
}

// Mount deck routes
deckRoutes.injectDependencies(Card, getPriceWithFallback);
app.use('/api/decks', deckRoutes);

// Search Scryfall API for card data with Exor Games pricing
app.get('/api/scryfall/search', async (req, res) => {
  try {
    const { name, setCode, collectorNumber } = req.query;
    if (!name) return res.status(400).json({ message: 'Card name required' });

    // Get card data from Scryfall (cached for 24 hours)
    const cacheKey = `scryfall:${name.toLowerCase()}:${(setCode || '').toLowerCase()}:${collectorNumber || ''}`;
    const { cardData } = await cachedApiCall(cacheKey, () => fetchCardFromScryfall(name, setCode, collectorNumber));

    // Get pricing from Exor Games (with Scryfall backup)
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
      types: cardData.type_line ? cardData.type_line.split('—')[0].trim().split(' ') : [],
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

// Update prices from Exor Games (with Scryfall backup)
app.post('/api/cards/:id/update-price', requireAuth, requireEditor, activityLoggers.priceUpdate, async (req, res) => {
  try {
    const { force, fullData } = req.query; // Optional: force update, fullData for complete card info
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    // Skip if card already has price and oracle text (unless force=true or fullData=true)
    if (!force && !fullData && card.price > 0 && card.oracleText) {
      return res.json({
        ...card.toObject(),
        skipped: true,
        message: 'Card already has price and data. Use force=true to update anyway.'
      });
    }

    // If fullData is requested, fetch complete card data from Scryfall
    if (fullData === 'true') {
      try {
        const { cardData } = await fetchCardFromScryfall(card.name, card.setCode, card.collectorNumber);

        // Get pricing
        const priceData = await getPriceWithFallback(card.name, card.isFoil);

        // Cache image and get local URL
        const scryfallImageUrl = cardData.image_uris ? cardData.image_uris.normal : null;
        const cachedImageUrl = await cacheCardImage(cardData.id, scryfallImageUrl);

        // Update all card fields with Scryfall data
        card.set = cardData.set_name;
        card.setCode = cardData.set.toUpperCase();
        card.collectorNumber = cardData.collector_number;
        card.rarity = cardData.rarity[0].toUpperCase();
        card.colors = cardData.colors || [];
        card.types = cardData.type_line ? cardData.type_line.split('—')[0].trim().split(' ') : [];
        card.manaCost = cardData.mana_cost || '';
        card.scryfallId = cardData.id;
        card.imageUrl = cachedImageUrl;
        card.oracleText = cardData.oracle_text || '';
        card.price = priceData.usd > 0 ? priceData.usd : card.price;
      } catch (error) {
        console.error(`Failed to fetch full data for ${card.name}:`, error.message);
        // Fall back to just price update
        const priceData = await getPriceWithFallback(card.name, card.isFoil);
        card.price = priceData.usd > 0 ? priceData.usd : card.price;
      }
    } else {
      // Just update price and oracle text
      const priceData = await getPriceWithFallback(card.name, card.isFoil);
      const price = priceData.usd > 0 ? priceData.usd : card.price;
      card.price = price;

      // Also fetch oracle text if missing
      if (!card.oracleText) {
        try {
          const response = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(card.name)}`);
          card.oracleText = response.data.oracle_text || '';
        } catch (error) {
          console.error(`Failed to fetch oracle text for ${card.name}:`, error.message);
        }
      }
    }

    await card.save();

    res.json(card);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk update all prices from Exor Games (with Scryfall backup)
app.post('/api/cards/update-all-prices', requireAuth, requireEditor, activityLoggers.priceBulkUpdate, async (req, res) => {
  try {
    const { force, fullData } = req.query; // Optional: force update, fullData for complete card info
    const cardQuery = buildUserQuery({}, req);
    const cards = await Card.find(cardQuery);
    let updated = 0;
    let skipped = 0;

    for (const card of cards) {
      try {
        // Skip if card already has price and oracle text (unless force=true or fullData=true)
        if (!force && !fullData && card.price > 0 && card.oracleText) {
          console.log(`Skipping ${card.name} - already has price and data`);
          skipped++;
          continue;
        }

        // If fullData is requested, fetch complete card data from Scryfall
        if (fullData === 'true') {
          try {
            const { cardData } = await fetchCardFromScryfall(card.name, card.setCode, card.collectorNumber);

            // Get pricing
            const priceData = await getPriceWithFallback(card.name, card.isFoil);

            // Cache image and get local URL
            const scryfallImageUrl = cardData.image_uris ? cardData.image_uris.normal : null;
            const cachedImageUrl = await cacheCardImage(cardData.id, scryfallImageUrl);

            // Update all card fields with Scryfall data
            card.set = cardData.set_name;
            card.setCode = cardData.set.toUpperCase();
            card.collectorNumber = cardData.collector_number;
            card.rarity = cardData.rarity[0].toUpperCase();
            card.colors = cardData.colors || [];
            card.types = cardData.type_line ? cardData.type_line.split('—')[0].trim().split(' ') : [];
            card.manaCost = cardData.mana_cost || '';
            card.scryfallId = cardData.id;
            card.imageUrl = cachedImageUrl;
            card.oracleText = cardData.oracle_text || '';
            card.price = priceData.usd > 0 ? priceData.usd : card.price;
          } catch (error) {
            console.error(`Failed to fetch full data for ${card.name}:`, error.message);
            // Fall back to just price update
            const priceData = await getPriceWithFallback(card.name, card.isFoil);
            card.price = priceData.usd > 0 ? priceData.usd : card.price;
          }
        } else {
          // Just update price and oracle text
          const priceData = await getPriceWithFallback(card.name, card.isFoil);
          const price = priceData.usd > 0 ? priceData.usd : card.price;
          card.price = price;

          // Also fetch oracle text if missing
          if (!card.oracleText) {
            try {
              const response = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(card.name)}`);
              card.oracleText = response.data.oracle_text || '';
            } catch (error) {
              console.error(`Failed to fetch oracle text for ${card.name}:`, error.message);
            }
          }
        }

        await card.save();
        updated++;
        // Rate limiting - be respectful to servers
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error updating ${card.name}:`, error.message);
      }
    }

    res.json({
      message: `Updated ${updated} of ${cards.length} cards (${skipped} skipped)`,
      updated,
      skipped,
      total: cards.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk import cards from list (with offline fallback)
app.post('/api/cards/bulk-import', requireAuth, requireEditor, activityLoggers.cardBulkImport, async (req, res) => {
  try {
    const { cardList, offlineMode } = req.body; // Array of strings like "4 Lightning Bolt" or "Lightning Bolt"
    const userId = getUserId(req);
    const results = {
      added: [],
      failed: [],
      merged: [],
      offline: [],
      total: cardList.length
    };

    for (const line of cardList) {
      try {
        // Parse card line to extract name, quantity, and metadata
        const parsed = parseCardLine(line);
        const { cardName, quantity, setCode, collectorNumber, rarity } = parsed;

        if (!cardName) continue;

        let cardInfo;
        let isOffline = offlineMode;

        // Try to fetch from Scryfall (unless explicitly in offline mode)
        if (!offlineMode) {
          try {
            // Use new fetchCardFromScryfall with exact lookup and fallback
            const { cardData } = await fetchCardFromScryfall(cardName, setCode, collectorNumber);

            // Get pricing
            const priceData = await getPriceWithFallback(cardName);

            // Cache image and get local URL
            const scryfallImageUrl = cardData.image_uris ? cardData.image_uris.normal : null;
            const cachedImageUrl = await cacheCardImage(cardData.id, scryfallImageUrl);

            // Prepare card object with full data including new fields
            cardInfo = {
              name: cardData.name,
              set: cardData.set_name,
              setCode: setCode || cardData.set.toUpperCase(),
              collectorNumber: collectorNumber || cardData.collector_number,
              rarity: rarity || cardData.rarity[0].toUpperCase(),
              quantity: quantity,
              condition: 'NM',
              price: priceData.usd,
              colors: cardData.colors || [],
              types: cardData.type_line ? cardData.type_line.split('—')[0].trim().split(' ') : [],
              manaCost: cardData.mana_cost || '',
              scryfallId: cardData.id,
              imageUrl: cachedImageUrl,
              isFoil: false,
              oracleText: cardData.oracle_text || '',
              tags: []
            };
          } catch (scryfallError) {
            // Scryfall failed - fall back to offline mode for this card
            console.log(`Scryfall failed for ${cardName}, using offline mode`);
            isOffline = true;
          }
        }

        // If offline or Scryfall failed, create card with minimal data
        if (isOffline) {
          cardInfo = {
            name: cardName,
            set: 'Unknown',
            setCode: setCode || null,
            collectorNumber: collectorNumber || null,
            rarity: rarity || null,
            quantity: quantity,
            condition: 'NM',
            price: 0,
            colors: [],
            types: [],
            manaCost: '',
            scryfallId: null,
            imageUrl: null,
            isFoil: false,
            oracleText: '',
            tags: []
          };
        }

        // Check for existing card with smart duplicate detection
        // Priority: use collector number if available for exact matching
        let baseQuery = {
          name: cardInfo.name,
          condition: cardInfo.condition,
          isFoil: cardInfo.isFoil || false
        };

        // If we have exact collector number data, use it for duplicate detection (more precise)
        if (cardInfo.setCode && cardInfo.collectorNumber) {
          baseQuery.setCode = cardInfo.setCode;
          baseQuery.collectorNumber = cardInfo.collectorNumber;
        } else {
          // Fall back to set name matching (backward compatible)
          baseQuery.set = cardInfo.set;
        }

        const query = buildUserQuery(baseQuery, req);
        const existingCard = await Card.findOne(query);

        if (existingCard) {
          existingCard.quantity += quantity;
          await existingCard.save();
          if (isOffline) {
            results.offline.push(`${cardInfo.name} - merged ${quantity} (offline)`);
          } else {
            results.merged.push(`${cardInfo.name} (${cardInfo.set}) - merged ${quantity}`);
          }
        } else {
          if (userId) cardInfo.userId = userId;
          const newCard = new Card(cardInfo);
          await newCard.save();
          if (isOffline) {
            results.offline.push(`${cardInfo.name} - added ${quantity} (offline, no details)`);
          } else {
            results.added.push(`${cardInfo.name} (${cardInfo.set}) - added ${quantity}`);
          }
        }

        // Rate limiting (skip in offline mode)
        if (!isOffline) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        console.error(`Error importing ${line}:`, error.message);
        results.failed.push(`${line} - ${error.message}`);
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk import full card data (for JSON/CSV imports)
app.post('/api/cards/bulk-import-full', requireAuth, requireEditor, activityLoggers.cardBulkImport, async (req, res) => {
  try {
    const { cards } = req.body; // Array of card objects with full data
    const userId = getUserId(req);
    const results = {
      added: [],
      failed: [],
      merged: [],
      total: cards.length
    };

    for (const cardData of cards) {
      try {
        if (!cardData.name) {
          results.failed.push('Unknown - missing card name');
          continue;
        }

        // Normalize the card data
        const cardInfo = {
          name: cardData.name,
          set: cardData.set || 'Unknown',
          setCode: cardData.setCode || '',
          collectorNumber: cardData.collectorNumber || '',
          rarity: cardData.rarity || '',
          quantity: parseInt(cardData.quantity) || 1,
          condition: cardData.condition || 'NM',
          price: parseFloat(cardData.price) || 0,
          colors: Array.isArray(cardData.colors) ? cardData.colors :
                  (typeof cardData.colors === 'string' && cardData.colors ? cardData.colors.split(';') : []),
          types: Array.isArray(cardData.types) ? cardData.types :
                 (typeof cardData.types === 'string' && cardData.types ? cardData.types.split(';') : []),
          manaCost: cardData.manaCost || '',
          scryfallId: cardData.scryfallId || null,
          imageUrl: cardData.imageUrl || null,
          isFoil: cardData.isFoil === true || cardData.isFoil === 'true',
          isToken: cardData.isToken === true || cardData.isToken === 'true',
          oracleText: cardData.oracleText || '',
          tags: Array.isArray(cardData.tags) ? cardData.tags :
                (typeof cardData.tags === 'string' && cardData.tags ? cardData.tags.split(';') : [])
        };

        // Check for existing card (auto-merge by name + set + condition + isFoil)
        const existingQuery = buildUserQuery({
          name: cardInfo.name,
          set: cardInfo.set,
          condition: cardInfo.condition,
          isFoil: cardInfo.isFoil
        }, req);
        const existingCard = await Card.findOne(existingQuery);

        if (existingCard) {
          existingCard.quantity += cardInfo.quantity;
          await existingCard.save();
          results.merged.push(`${cardInfo.name} (${cardInfo.set}) - merged ${cardInfo.quantity}`);
        } else {
          if (userId) cardInfo.userId = userId;
          const newCard = new Card(cardInfo);
          await newCard.save();
          results.added.push(`${cardInfo.name} (${cardInfo.set}) - added ${cardInfo.quantity}`);
        }

      } catch (error) {
        console.error(`Error importing card:`, error.message);
        results.failed.push(`${cardData.name || 'Unknown'} - ${error.message}`);
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Offline-only bulk import (no API calls)
app.post('/api/cards/bulk-import-offline', requireAuth, requireEditor, activityLoggers.cardBulkImport, async (req, res) => {
  try {
    const { cardList } = req.body;
    const userId = getUserId(req);
    const results = {
      added: [],
      failed: [],
      merged: [],
      total: cardList.length
    };

    for (const line of cardList) {
      try {
        // Parse quantity and card name
        const match = line.trim().match(/^(\d+)\s+(.+)$/);
        let quantity = 1;
        let cardName = line.trim();

        if (match) {
          quantity = parseInt(match[1]);
          cardName = match[2];
        }

        // Remove set code and collector number if present
        cardName = cardName.replace(/\s*\([A-Z0-9]+\)\s*[A-Z0-9\-]*$/i, '').trim();

        if (!cardName) continue;

        // Create card with minimal data (no API calls)
        const cardInfo = {
          name: cardName,
          set: 'Unknown',
          quantity: quantity,
          condition: 'NM',
          price: 0,
          colors: [],
          types: [],
          manaCost: '',
          scryfallId: null,
          imageUrl: null,
          isFoil: false,
          oracleText: '',
          tags: []
        };

        // Check for existing card (auto-merge) scoped to user
        const existingQuery = buildUserQuery({
          name: cardInfo.name,
          set: cardInfo.set,
          condition: cardInfo.condition,
          isFoil: cardInfo.isFoil
        }, req);
        const existingCard = await Card.findOne(existingQuery);

        if (existingCard) {
          existingCard.quantity += quantity;
          await existingCard.save();
          results.merged.push(`${cardInfo.name} - merged ${quantity} (offline)`);
        } else {
          if (userId) cardInfo.userId = userId;
          const newCard = new Card(cardInfo);
          await newCard.save();
          results.added.push(`${cardInfo.name} - added ${quantity} (offline, no details)`);
        }

      } catch (error) {
        console.error(`Error importing ${line}:`, error.message);
        results.failed.push(`${line} - ${error.message}`);
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new card (or merge with existing if duplicate)
app.post('/api/cards', requireAuth, requireEditor, activityLoggers.cardCreate, async (req, res) => {
  try {
    const { name, set, condition, quantity, isFoil } = req.body;
    const userId = getUserId(req);

    // Check if card with same name, set, condition, and foil status already exists (for this user)
    const existingQuery = buildUserQuery({ name, set, condition, isFoil: isFoil || false }, req);
    const existingCard = await Card.findOne(existingQuery);

    if (existingCard) {
      // Card exists - increment quantity instead of creating duplicate
      existingCard.quantity += quantity || 1;
      const updatedCard = await existingCard.save();
      return res.status(200).json({
        ...updatedCard.toObject(),
        merged: true,
        message: `Merged with existing card. New quantity: ${updatedCard.quantity}`
      });
    }

    // Card doesn't exist - create new entry
    const cardData = { ...req.body };
    if (userId) cardData.userId = userId;
    const card = new Card(cardData);
    const newCard = await card.save();
    res.status(201).json(newCard);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update card
app.put('/api/cards/:id', requireAuth, requireEditor, activityLoggers.cardUpdate, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    // Don't allow changing userId
    const { userId: _, ...updateData } = req.body;
    Object.assign(card, updateData);
    const updatedCard = await card.save();
    res.json(updatedCard);
  } catch (error) {
    res.status(400).json({ message: error.message });
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

// Delete card
app.delete('/api/cards/:id', requireAuth, requireEditor, activityLoggers.cardDelete, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    await card.deleteOne();
    res.json({ message: 'Card deleted' });
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

    res.json({
      totalCards,
      uniqueCards: cards.length,
      totalValue,
      ignoredValue,
      colorDistribution: colorStats,
      typeDistribution: typeStats,
      cachedImageCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Tag Management Endpoints

// Add tag to a card
app.post('/api/cards/:id/tags', requireAuth, requireEditor, async (req, res) => {
  try {
    const { tag } = req.body;
    if (!tag || typeof tag !== 'string') {
      return res.status(400).json({ message: 'Tag must be a non-empty string' });
    }

    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    // Prevent duplicates, normalize to lowercase
    const normalizedTag = tag.toLowerCase().trim();
    if (!card.tags) {
      card.tags = [];
    }
    if (!card.tags.includes(normalizedTag)) {
      card.tags.push(normalizedTag);
      await card.save();
    }

    res.json(card);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove tag from a card
app.delete('/api/cards/:id/tags/:tag', requireAuth, requireEditor, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    if (card.tags) {
      card.tags = card.tags.filter(t => t !== req.params.tag);
      await card.save();
    }

    res.json(card);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

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

// Bulk update oracle text for existing cards (one-time migration/backfill)
app.post('/api/cards/update-all-oracle-text', requireAuth, requireEditor, async (req, res) => {
  try {
    const cardQuery = buildUserQuery({}, req);
    const cards = await Card.find(cardQuery);
    let updated = 0;
    let failed = 0;

    for (const card of cards) {
      try {
        // Skip if already has oracle text
        if (card.oracleText && card.oracleText.length > 0) {
          continue;
        }

        // Fetch from Scryfall using card name
        const response = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(card.name)}`);
        card.oracleText = response.data.oracle_text || '';
        await card.save();
        updated++;

        // Rate limiting - be respectful to Scryfall (100ms delay)
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error updating oracle text for ${card.name}:`, error.message);
        failed++;
      }
    }

    res.json({
      message: `Updated ${updated} cards, ${failed} failed`,
      updated,
      failed,
      total: cards.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Migrate existing cards to use cached images
app.post('/api/cards/migrate-images-to-cache', requireAuth, requireEditor, async (req, res) => {
  try {
    const query = buildUserQuery({ scryfallId: { $ne: null } }, req);
    const cards = await Card.find(query);
    let migrated = 0;
    let failed = 0;

    for (const card of cards) {
      try {
        // Skip if already using cached URL
        if (card.imageUrl && card.imageUrl.startsWith('/api/images/')) {
          continue;
        }

        // If card has Scryfall ID but no image URL, fetch from Scryfall
        if (!card.imageUrl && card.scryfallId) {
          try {
            const response = await axios.get(`https://api.scryfall.com/cards/${card.scryfallId}`);
            card.imageUrl = response.data.image_uris ? response.data.image_uris.normal : null;
          } catch (error) {
            console.error(`Failed to fetch image URL for ${card.name}:`, error.message);
            failed++;
            continue;
          }
        }

        // Cache the image
        if (card.imageUrl) {
          const cachedUrl = await cacheCardImage(card.scryfallId, card.imageUrl);
          if (cachedUrl !== card.imageUrl) {
            card.imageUrl = cachedUrl;
            await card.save();
            migrated++;
          }
        }

        // Rate limiting - be respectful to Scryfall
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error migrating ${card.name}:`, error.message);
        failed++;
      }
    }

    res.json({
      message: `Migrated ${migrated} cards, ${failed} failed`,
      migrated,
      failed,
      total: cards.length
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

  // Serve image with proper headers
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

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
    const items = await WishlistItem.find(query).sort({ priority: -1, name: 1 });
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
// BULK OPERATIONS ROUTES
// ============================================

// Bulk update multiple cards
app.post('/api/cards/bulk-update', requireAuth, requireEditor, activityLoggers.cardBulkUpdate, async (req, res) => {
  try {
    const { cardIds, updates } = req.body;

    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({ message: 'cardIds array is required' });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'updates object is required' });
    }

    let updatedCount = 0;
    const results = [];

    for (const cardId of cardIds) {
      try {
        const query = buildUserQuery({ _id: cardId }, req);
        const card = await Card.findOne(query);
        if (!card) {
          results.push({ id: cardId, status: 'not found' });
          continue;
        }

        // Apply updates
        if (updates.condition) card.condition = updates.condition;
        if (updates.location !== undefined) card.location = updates.location;

        // Handle tag operations
        if (updates.addTags && Array.isArray(updates.addTags)) {
          if (!card.tags) card.tags = [];
          for (const tag of updates.addTags) {
            const normalizedTag = tag.toLowerCase().trim();
            if (!card.tags.includes(normalizedTag)) {
              card.tags.push(normalizedTag);
            }
          }
        }

        if (updates.removeTags && Array.isArray(updates.removeTags)) {
          if (card.tags) {
            card.tags = card.tags.filter(t => !updates.removeTags.includes(t));
          }
        }

        await card.save();
        updatedCount++;
        results.push({ id: cardId, status: 'updated' });
      } catch (error) {
        results.push({ id: cardId, status: 'error', error: error.message });
      }
    }

    res.json({
      message: `Updated ${updatedCount} of ${cardIds.length} cards`,
      updated: updatedCount,
      total: cardIds.length,
      results
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk delete multiple cards
app.delete('/api/cards/bulk-delete', requireAuth, requireEditor, activityLoggers.cardBulkDelete, async (req, res) => {
  try {
    const { cardIds } = req.body;

    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({ message: 'cardIds array is required' });
    }

    let deletedCount = 0;
    const results = [];

    for (const cardId of cardIds) {
      try {
        const query = buildUserQuery({ _id: cardId }, req);
        const card = await Card.findOne(query);
        if (!card) {
          results.push({ id: cardId, status: 'not found' });
          continue;
        }

        await card.deleteOne();
        deletedCount++;
        results.push({ id: cardId, status: 'deleted' });
      } catch (error) {
        results.push({ id: cardId, status: 'error', error: error.message });
      }
    }

    res.json({
      message: `Deleted ${deletedCount} of ${cardIds.length} cards`,
      deleted: deletedCount,
      total: cardIds.length,
      results
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

    res.json({
      totalGames,
      winsByPlayer,
      winRates,
      gamesByFormat,
      averageTurns: gamesWithTurns > 0 ? Math.round(totalTurns / gamesWithTurns) : 0,
      averageDuration: gamesWithDuration > 0 ? Math.round(totalDuration / gamesWithDuration) : 0
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});