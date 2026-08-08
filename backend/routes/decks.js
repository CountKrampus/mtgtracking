const express = require('express');
const router = express.Router();
const axios = require('axios');
const mongoose = require('mongoose');
const Deck = require('../models/Deck');
const {
  calculateDeckStatistics,
  validateDeck,
  parseTextList,
  parseMoxfieldURL,
  parseArchidektURL,
  parseArenaText,
  parseTappedOutURL,
  parseMTGGoldfishURL
} = require('../utils/deckHelpers');
const { requireAuth, requireEditor } = require('../middleware/auth');
const { buildUserQuery, getUserId } = require('../middleware/multiUser');
const { activityLoggers } = require('../middleware/activityLogger');
const { checkAndAwardBadges } = require('../utils/badgeManager');
const { calculateSaltScore, estimatePowerLevel, calculateManabaseScore, calculateDeckHealthScore, calculateGlobalScore, COLOR_SOURCES, NONBASIC_LAND_NAMES } = require('../utils/deckAnalysis');
const { cachedApiCall } = require('../utils/apiCache');
const User = require('../models/User');

// Import Card model and getPriceWithFallback from parent scope
// These will be injected when mounting the router
let Card;
let getPriceWithFallback;
let GameSession;

function injectDependencies(cardModel, priceFunction, gameSessionModel) {
  Card = cardModel;
  getPriceWithFallback = priceFunction;
  GameSession = gameSessionModel;
}

// Category search queries for GET /:id/recommendations - matches the style
// of cardInsights.js's MECHANIC_PATTERNS/KEYWORD_PATTERNS, but lives here
// (not cardInsights.js) since this route is deck-scoped, not card-scoped,
// and needs the Deck model this file already has access to.
const RECOMMENDATION_CATEGORIES = {
  ramp: 'o:"search your library" o:"land" OR o:"add" o:"mana"',
  draw: 'o:"draw a card" OR o:"draw two cards"',
  removal: 'o:"destroy target" OR o:"exile target"',
};

// Union of colors from the commander(s) and every mainDeck card - the same
// "what colors does this deck actually play" signal already used by
// calculateManabaseScore/estimatePowerLevel in utils/deckAnalysis.js.
function getDeckColorIdentity(deck) {
  const colors = new Set();
  // commander/partnerCommander store color identity under `colorIdentity`
  // (per the Deck schema), while mainDeck cards store it under `colors` -
  // these are genuinely different field names, not interchangeable.
  [deck.commander, deck.partnerCommander].forEach(card => {
    (card?.colorIdentity || []).forEach(c => colors.add(c));
  });
  deck.mainDeck.forEach(card => {
    (card?.colors || []).forEach(c => colors.add(c));
  });
  return Array.from(colors);
}

// Get all decks
router.get('/', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({}, req);
    const decks = await Deck.find(query).sort({ name: 1 });
    res.json(decks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Public: get a deck by share code (no auth required)
router.get('/shared/:shareCode', async (req, res) => {
  try {
    const deck = await Deck.findOne({ shareCode: req.params.shareCode })
      .populate('userId', 'username displayName')
      .lean();
    if (!deck) return res.status(404).json({ message: 'Deck not found' });
    const owner = deck.userId || {};
    const { userId, ...deckData } = deck;
    res.json({ deck: deckData, owner: { username: owner.username, displayName: owner.displayName } });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Public: browse community decks (no auth required)
router.get('/community', async (req, res) => {
  try {
    const { format, colors, commander, tags, sort = 'newest', page = 1 } = req.query;
    const filter = { isPublic: true };
    if (format) filter.format = format;
    if (colors) {
      const colorList = colors.split(',').map(c => c.trim()).filter(Boolean);
      if (colorList.length) filter['commander.colorIdentity'] = { $all: colorList };
    }
    if (commander) {
      const escapedCommander = commander.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter['commander.name'] = { $regex: escapedCommander, $options: 'i' };
    }
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagList.length) filter.tags = { $in: tagList };
    }

    const sortMap = {
      newest:   { updatedAt: -1 },
      imported: { importCount: -1 },
      name:     { name: 1 }
    };
    const sortQuery = sortMap[sort] || sortMap.newest;
    const PAGE_SIZE = 20;
    const safePage = Math.max(1, parseInt(page) || 1);
    const skip = (safePage - 1) * PAGE_SIZE;

    const [decks, total] = await Promise.all([
      Deck.find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(PAGE_SIZE)
        .populate('userId', 'username displayName')
        .lean(),
      Deck.countDocuments(filter)
    ]);

    const result = decks.map(d => {
      const { mainDeck, userId, ...rest } = d;
      return { ...rest, cardCount: (mainDeck || []).length, owner: { username: userId?.username, displayName: userId?.displayName } };
    });

    res.json({ decks: result, total, page: safePage, pages: Math.ceil(total / PAGE_SIZE) });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Get single deck
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query).lean();
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    // Compute totalValue live from mainDeck card prices
    const mainDeck = deck.mainDeck || [];
    let totalValue = 0;
    if (mainDeck.length > 0 && Card) {
      const names = [...new Set(mainDeck.map(c => c.name).filter(Boolean))];
      const priceRecords = await Card.find(
        buildUserQuery({ name: { $in: names } }, req)
      ).select('name price').lean();
      const priceMap = {};
      for (const r of priceRecords) {
        if (r.price > 0) priceMap[r.name] = r.price;
      }
      for (const c of mainDeck) {
        totalValue += (priceMap[c.name] || 0) * (c.quantity || 1);
      }
    }

    res.json({ ...deck, totalValue });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create deck
router.post('/', requireAuth, requireEditor, activityLoggers.deckCreate, async (req, res) => {
  try {
    const userId = getUserId(req);
    const deckData = { ...req.body };
    if (userId) deckData.userId = userId;
    const deck = new Deck(deckData);
    deck.statistics = calculateDeckStatistics(deck);
    await deck.save();
    res.status(201).json(deck);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update deck
router.put('/:id', requireAuth, requireEditor, activityLoggers.deckUpdate, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    // Snapshot old mainDeck for diffing (scryfallId -> quantity map)
    const oldDeckMap = new Map();
    (deck.mainDeck || []).forEach(card => {
      if (card.scryfallId) oldDeckMap.set(card.scryfallId, { name: card.name, quantity: card.quantity || 1 });
    });

    const { userId: _, ...updateData } = req.body;
    Object.assign(deck, updateData);
    deck.statistics = calculateDeckStatistics(deck);

    // Build new deck map for diffing
    const newDeckMap = new Map();
    (deck.mainDeck || []).forEach(card => {
      if (card.scryfallId) newDeckMap.set(card.scryfallId, { name: card.name, quantity: card.quantity || 1 });
    });

    // Compute diff
    const changes = [];
    // Cards added or quantity increased
    newDeckMap.forEach((newCard, scryfallId) => {
      const old = oldDeckMap.get(scryfallId);
      if (!old) {
        changes.push({ type: 'add', cardName: newCard.name, scryfallId, quantity: newCard.quantity });
      } else if (newCard.quantity > old.quantity) {
        changes.push({ type: 'add', cardName: newCard.name, scryfallId, quantity: newCard.quantity - old.quantity });
      }
    });
    // Cards removed or quantity decreased
    oldDeckMap.forEach((oldCard, scryfallId) => {
      const newCard = newDeckMap.get(scryfallId);
      if (!newCard) {
        changes.push({ type: 'remove', cardName: oldCard.name, scryfallId, quantity: oldCard.quantity });
      } else if (oldCard.quantity > newCard.quantity) {
        changes.push({ type: 'remove', cardName: oldCard.name, scryfallId, quantity: oldCard.quantity - newCard.quantity });
      }
    });

    await deck.save();

    // Record deck change if diff is non-empty (fire-and-forget)
    if (changes.length > 0) {
      const userId = getUserId(req);
      mongoose.model('DeckChange').create({ deckId: deck._id, userId, changes }).catch(() => {});
    }

    // Daily value snapshot (once per day per deck)
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const userId = getUserId(req);
      const existingSnap = await mongoose.model('DeckValueSnapshot').findOne({
        deckId: deck._id,
        createdAt: { $gte: todayStart }
      });
      if (!existingSnap) {
        await mongoose.model('DeckValueSnapshot').create({
          deckId: deck._id,
          userId,
          value: deck.totalValue || 0,
          cardCount: (deck.mainDeck || []).length
        });
      }
    } catch (snapErr) {
      console.error('Deck value snapshot error:', snapErr.message);
    }

    res.json(deck);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete deck
router.delete('/:id', requireAuth, requireEditor, activityLoggers.deckDelete, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });
    await deck.deleteOne();
    res.json({ message: 'Deck deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Import deck from text or URL
router.post('/import', requireAuth, requireEditor, async (req, res) => {
  try {
    const { source, data } = req.body;

    let parsedData;
    if (source === 'text') {
      parsedData = parseTextList(data);
    } else if (source === 'moxfield') {
      parsedData = await parseMoxfieldURL(data);
    } else if (source === 'archidekt') {
      parsedData = await parseArchidektURL(data);
    } else if (source === 'arena') {
      parsedData = parseArenaText(data);
    } else if (source === 'tappedout') {
      parsedData = await parseTappedOutURL(data);
    } else if (source === 'mtggoldfish') {
      parsedData = await parseMTGGoldfishURL(data);
    } else {
      return res.status(400).json({ message: 'Invalid source type' });
    }

    if (!parsedData.commander) {
      return res.status(400).json({ message: 'No commander found in deck list' });
    }

    // Fetch Scryfall data for commander
    const commanderData = await axios.get(
      `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(parsedData.commander)}`
    );
    const commander = {
      scryfallId: commanderData.data.id,
      name: commanderData.data.name,
      manaCost: commanderData.data.mana_cost,
      colorIdentity: commanderData.data.color_identity,
      imageUrl: commanderData.data.image_uris?.normal,
      oracleText: commanderData.data.oracle_text,
      flavorText: commanderData.data.flavor_text,
      typeLine: commanderData.data.type_line,
      power: commanderData.data.power,
      toughness: commanderData.data.toughness
    };

    // Partner commander if present
    let partnerCommander = null;
    if (parsedData.partnerCommander) {
      const partnerData = await axios.get(
        `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(parsedData.partnerCommander)}`
      );
      partnerCommander = {
        scryfallId: partnerData.data.id,
        name: partnerData.data.name,
        manaCost: partnerData.data.mana_cost,
        colorIdentity: partnerData.data.color_identity,
        imageUrl: partnerData.data.image_uris?.normal,
        oracleText: partnerData.data.oracle_text,
        flavorText: partnerData.data.flavor_text,
        typeLine: partnerData.data.type_line,
        power: partnerData.data.power,
        toughness: partnerData.data.toughness
      };
    }

    // Fetch Scryfall data for main deck (batch using collection endpoint)
    // Scryfall limits to 75 cards per request, so we need to batch
    // For split cards (e.g. "Warrant // Warden"), Scryfall collection endpoint only
    // resolves by the first half of the name — use that as the identifier.
    const identifiers = parsedData.mainDeck.map(card => ({
      name: card.name.includes(' // ') ? card.name.split(' // ')[0] : card.name,
    }));
    const batchSize = 75;
    const allScryfallCards = [];

    for (let i = 0; i < identifiers.length; i += batchSize) {
      const batch = identifiers.slice(i, i + batchSize);
      const batchResponse = await axios.post('https://api.scryfall.com/cards/collection', {
        identifiers: batch
      });
      allScryfallCards.push(...batchResponse.data.data);

      // Add delay between batches to respect rate limits
      if (i + batchSize < identifiers.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const quantityMap = {};
    for (const card of parsedData.mainDeck) {
      quantityMap[card.name.toLowerCase()] = card.quantity;
    }

    const mainDeck = allScryfallCards.map((scryfallCard) => ({
      scryfallId: scryfallCard.id,
      name: scryfallCard.name,
      manaCost: scryfallCard.mana_cost,
      types: scryfallCard.type_line?.split('—')?.[0]?.trim().split(' ') || [],
      colors: scryfallCard.colors || [],
      imageUrl: scryfallCard.image_uris?.normal,
      quantity: quantityMap[scryfallCard.name.toLowerCase()] || 1,
    }));

    const deckData = {
      name: parsedData.name || 'Imported Deck',
      description: parsedData.description || '',
      commander,
      partnerCommander,
      mainDeck
    };

    // Calculate statistics
    const statistics = calculateDeckStatistics(deckData);

    // Validate
    const validation = validateDeck(deckData);

    res.json({ deckData, statistics, validation });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Check deck ownership against collection
router.get('/:id/ownership', requireAuth, async (req, res) => {
  try {
    const deckQuery = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(deckQuery);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    if (!Card) {
      return res.status(500).json({ message: 'Card model not available' });
    }

    const cardQuery = buildUserQuery({}, req);
    const collectionCards = await Card.find(cardQuery);
    const collectionMap = new Map();

    collectionCards.forEach(card => {
      if (card.scryfallId) {
        if (!collectionMap.has(card.scryfallId)) {
          collectionMap.set(card.scryfallId, []);
        }
        collectionMap.get(card.scryfallId).push(card);
      }
    });

    const ownedCards = [];
    const missingCards = [];
    let ownedValue = 0;
    let missingValue = 0;

    // deck.partnerCommander is a Mongoose single-nested subdocument path -
    // even when stored as null, Mongoose wraps it in an object that is
    // truthy on `deck.partnerCommander ? ... : ...` despite serializing to
    // null. Checking a real field (name) instead of object identity avoids
    // injecting a phantom empty "card" (no scryfallId) into every deck
    // that has no actual partner commander.
    const allDeckCards = [
      deck.commander,
      ...(deck.partnerCommander?.name ? [deck.partnerCommander] : []),
      ...deck.mainDeck
    ];

    for (const deckCard of allDeckCards) {
      const owned = collectionMap.get(deckCard.scryfallId) || [];
      const totalOwned = owned.reduce((sum, c) => sum + c.quantity, 0);

      if (totalOwned > 0) {
        ownedCards.push({
          ...deckCard.toObject ? deckCard.toObject() : deckCard,
          collectionQuantity: totalOwned,
          price: owned[0].price
        });
        ownedValue += owned[0].price;
      } else {
        missingCards.push({
          ...deckCard.toObject ? deckCard.toObject() : deckCard,
          price: deckCard.price || 0
        });
        missingValue += deckCard.price || 0;
      }
    }

    res.json({
      ownedCards,
      missingCards,
      summary: {
        ownedCount: ownedCards.length,
        missingCount: missingCards.length,
        ownedValue: Math.round(ownedValue * 100) / 100,
        missingValue: Math.round(missingValue * 100) / 100,
        totalValue: Math.round((ownedValue + missingValue) * 100) / 100,
        completionPercentage: Math.round((ownedCards.length / allDeckCards.length) * 100)
      }
    });
  } catch (error) {
    console.error('Ownership check error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Validate deck
router.post('/:id/validate', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    const validation = validateDeck(deck);
    res.json(validation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add card from collection to deck
router.post('/:id/add-card', requireAuth, requireEditor, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    const { scryfallId, name, manaCost, types, colors, imageUrl } = req.body;

    // Check if card already in deck
    const existingCard = deck.mainDeck.find(c => c.scryfallId === scryfallId);
    if (existingCard) {
      return res.status(400).json({ message: 'Card already in deck' });
    }

    deck.mainDeck.push({
      scryfallId,
      name,
      manaCost,
      types,
      colors,
      imageUrl,
      quantity: 1
    });

    deck.statistics = calculateDeckStatistics(deck);
    await deck.save();

    res.json(deck);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get deck game stats (win rate, matchups, etc.)
router.get('/:id/stats', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    // Compute deck value from the owned collection (mirrors /:id/ownership's
    // owned/missing-value pass) so estimatePowerLevel can factor in deckValue.
    let deckValue = 0;
    if (Card) {
      const cardQuery = buildUserQuery({}, req);
      const collectionCards = await Card.find(cardQuery);
      const collectionMap = new Map();
      collectionCards.forEach(card => {
        if (card.scryfallId) {
          if (!collectionMap.has(card.scryfallId)) {
            collectionMap.set(card.scryfallId, []);
          }
          collectionMap.get(card.scryfallId).push(card);
        }
      });

      // Same Mongoose single-nested-subdocument truthiness gotcha as
      // /:id/ownership above - check a real field, not object identity.
      const allDeckCards = [
        deck.commander,
        ...(deck.partnerCommander?.name ? [deck.partnerCommander] : []),
        ...deck.mainDeck
      ];

      for (const deckCard of allDeckCards) {
        const owned = collectionMap.get(deckCard.scryfallId) || [];
        const totalOwned = owned.reduce((sum, c) => sum + c.quantity, 0);
        if (totalOwned > 0) {
          deckValue += owned[0].price;
        } else {
          deckValue += deckCard.price || 0;
        }
      }
    }

    const saltScore = calculateSaltScore(deck);
    const powerLevel = estimatePowerLevel(deck, deckValue);
    const manabaseScore = calculateManabaseScore(deck);
    const healthScore = calculateDeckHealthScore(deck);
    const globalScore = calculateGlobalScore(powerLevel, saltScore, manabaseScore, healthScore);

    if (!GameSession) {
      return res.json({ gamesPlayed: 0, wins: 0, winRate: 0, avgPlacement: 0, avgTurns: 0, avgDuration: 0, bestMatchups: [], worstMatchups: [], powerLevel, saltScore, manabaseScore, healthScore, globalScore });
    }

    const deckId = deck._id;
    const sessions = await GameSession.find({ 'players.deckId': deckId });

    let gamesPlayed = 0, wins = 0, totalPlacement = 0, totalTurns = 0, totalDuration = 0;
    let gamesWithTurns = 0, gamesWithDuration = 0;
    const matchupMap = {}; // commanderName -> { wins, losses }

    sessions.forEach(session => {
      const player = session.players.find(p => p.deckId && p.deckId.toString() === deckId.toString());
      if (!player) return;

      gamesPlayed++;
      if (player.isWinner) wins++;
      if (player.placement) totalPlacement += player.placement;
      if (session.turns > 0) { totalTurns += session.turns; gamesWithTurns++; }
      if (session.duration > 0) { totalDuration += session.duration; gamesWithDuration++; }

      // Matchup tracking
      session.players.forEach(opp => {
        if (!opp.deckId || opp.deckId.toString() === deckId.toString()) return;
        const oppKey = opp.commanderName || opp.name || 'Unknown';
        if (!matchupMap[oppKey]) matchupMap[oppKey] = { commanderName: oppKey, wins: 0, losses: 0 };
        if (player.isWinner) matchupMap[oppKey].wins++;
        else matchupMap[oppKey].losses++;
      });
    });

    const matchups = Object.values(matchupMap).map(m => ({
      ...m,
      winRate: (m.wins + m.losses) > 0 ? Math.round((m.wins / (m.wins + m.losses)) * 100) : 0
    }));
    const bestMatchups = [...matchups].sort((a, b) => b.winRate - a.winRate).slice(0, 3);
    const worstMatchups = [...matchups].sort((a, b) => a.winRate - b.winRate).slice(0, 3);

    res.json({
      gamesPlayed,
      wins,
      winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
      avgPlacement: gamesPlayed > 0 ? Math.round((totalPlacement / gamesPlayed) * 10) / 10 : 0,
      avgTurns: gamesWithTurns > 0 ? Math.round(totalTurns / gamesWithTurns) : 0,
      avgDuration: gamesWithDuration > 0 ? Math.round(totalDuration / gamesWithDuration) : 0,
      bestMatchups,
      worstMatchups,
      powerLevel,
      saltScore,
      manabaseScore,
      healthScore,
      globalScore
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get card recommendations (ramp/draw/removal) for a deck, scoped to the
// user's collection by default or expanded to all of Magic
router.get('/:id/recommendations', requireAuth, async (req, res) => {
  try {
    const { category, scope = 'owned' } = req.query;
    if (!RECOMMENDATION_CATEGORIES[category]) {
      return res.status(400).json({ message: `category must be one of: ${Object.keys(RECOMMENDATION_CATEGORIES).join(', ')}` });
    }

    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    const colors = getDeckColorIdentity(deck);
    const colorQuery = colors.length > 0 ? `id<=${colors.map(c => c.toLowerCase()).join('')}` : 'id:c';

    const excludedNames = new Set([
      ...deck.mainDeck.map(c => c.name),
      deck.commander?.name,
      deck.partnerCommander?.name,
    ].filter(Boolean));

    const searchQuery = `(${RECOMMENDATION_CATEGORIES[category]}) ${colorQuery}`;
    let data;
    try {
      data = await cachedApiCall(`scryfall-search:${searchQuery}`, async () => {
        const response = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&order=edhrec&unique=cards`);
        return response.data;
      });
    } catch (scryfallError) {
      // Matches cardInsights.js's similar/synergies pattern: a failed/rate-
      // limited Scryfall call degrades to a fallback query rather than 500ing
      // the whole route. Here the fallback drops the color-identity filter
      // (the category query alone still returns something useful).
      try {
        data = await cachedApiCall(`scryfall-search:${RECOMMENDATION_CATEGORIES[category]}`, async () => {
          const fallback = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(RECOMMENDATION_CATEGORIES[category])}&order=edhrec&unique=cards`);
          return fallback.data;
        });
      } catch (fallbackError) {
        data = { data: [] };
      }
    }

    // Ownership is determined and filtered BEFORE truncating to a display
    // count - candidates are Scryfall-popularity-ordered, so a user's owned
    // matches often rank outside any small fixed window. Truncating first
    // would make scope=owned look sparse/empty for real collections even
    // when good matches exist further down the same result page.
    const candidates = (data.data || []).filter(c => !excludedNames.has(c.name));

    const ownedScryfallIds = new Set();
    const ownedNames = new Set();
    if (Card) {
      const cardQuery = buildUserQuery({}, req);
      const collectionCards = await Card.find(cardQuery);
      collectionCards.forEach(c => {
        if (c.scryfallId) ownedScryfallIds.add(c.scryfallId);
        else ownedNames.add(c.name.toLowerCase());
      });
    }

    const isOwned = (scryfallCard) => ownedScryfallIds.has(scryfallCard.id) || ownedNames.has(scryfallCard.name.toLowerCase());

    const cardsWithOwnership = candidates.map(c => ({ ...c, owned: isOwned(c) }));
    const scoped = scope === 'owned' ? cardsWithOwnership.filter(c => c.owned) : cardsWithOwnership;
    const cards = scoped.slice(0, 20);

    res.json({ category, scope, cards });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Looks up each candidate directly via Scryfall's /cards/named (the same
// endpoint utils/pricing.js's getPriceWithFallback calls internally) instead
// of calling getPriceWithFallback itself, because every candidate here needs
// a real, distinct scryfallId for POST /:id/add-card to work correctly
// afterward - that route's duplicate-check compares scryfallId, and
// getPriceWithFallback doesn't return one (price-only). Fetching the full
// card once gives price + scryfallId + image + mana cost together.
// Cached (24h, via cachedApiCall) since the same candidate pool is refetched
// every time a user re-runs the builder at a different budget for the same
// deck colors; `fromNetwork` tells the caller whether this call actually hit
// Scryfall, so the 500ms courtesy delay can be skipped on cache hits.
async function fetchCandidateCardData(name) {
  let fromNetwork = false;
  const data = await cachedApiCall(`manabase-candidate:${name}`, async () => {
    fromNetwork = true;
    const response = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
    return {
      scryfallId: response.data.id,
      manaCost: response.data.mana_cost || '',
      imageUrl: response.data.image_uris?.normal || response.data.card_faces?.[0]?.image_uris?.normal || null,
      price: response.data.prices?.usd ? parseFloat(response.data.prices.usd) : 0,
    };
  }).catch(error => {
    console.error(`Manabase builder: failed to fetch Scryfall data for "${name}":`, error.message);
    return { scryfallId: null, manaCost: '', imageUrl: null, price: 0 };
  });
  return { ...data, fromNetwork };
}

// Suggests a budget-constrained fixing-land package for a deck: candidates
// are drawn from COLOR_SOURCES filtered to the deck's actual color identity
// and priced live via Scryfall, then greedily packed by color-fixing-value-
// per-dollar until the budget runs out.
router.get('/:id/manabase-builder', requireAuth, async (req, res) => {
  try {
    const budget = parseFloat(req.query.budget);
    if (!budget || budget <= 0) {
      return res.status(400).json({ message: 'budget is required and must be a positive number' });
    }

    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    const deckColors = getDeckColorIdentity(deck);
    const existingNames = new Set([
      ...deck.mainDeck.map(c => c.name),
      deck.commander?.name,
      deck.partnerCommander?.name,
    ].filter(Boolean));

    const candidateEntries = Object.entries(COLOR_SOURCES).filter(([name, entry]) =>
      !existingNames.has(name) && entry.colors.some(c => deckColors.includes(c))
    );

    // Sequential with a small delay, matching this codebase's existing
    // convention for repeated Scryfall lookups (bulk price updates elsewhere
    // in this app use the same 500ms-between-calls courtesy).
    const priced = [];
    for (const [name, entry] of candidateEntries) {
      const relevantColorCount = entry.colors.filter(c => deckColors.includes(c)).length;
      const { fromNetwork, ...cardData } = await fetchCandidateCardData(name);
      // COLOR_SOURCES mixes actual lands with mana rocks that happen to fix
      // color (Signets, Arcane Signet, etc.) - NONBASIC_LAND_NAMES is the
      // same distinguishing list calculateManabaseScore's isLandCard uses.
      // Getting this right matters here specifically because the frontend
      // persists this `types` value verbatim when adding a card to the deck.
      const types = NONBASIC_LAND_NAMES.has(name) ? ['Land'] : ['Artifact'];
      priced.push({ name, colors: entry.colors, cycle: entry.cycle, relevantColorCount, types, ...cardData });
      if (fromNetwork) await new Promise(resolve => setTimeout(resolve, 500));
    }

    const byValue = [...priced].sort((a, b) => {
      const aValue = a.price > 0 ? a.relevantColorCount / a.price : 0;
      const bValue = b.price > 0 ? b.relevantColorCount / b.price : 0;
      return bValue - aValue;
    });

    const suggested = [];
    let runningTotal = 0;
    for (const card of byValue) {
      if (card.price === 0) continue; // no price data - skip from auto-suggestion, still listed in candidates
      if (runningTotal + card.price > budget) continue;
      suggested.push(card);
      runningTotal += card.price;
    }

    res.json({ budget, suggested, candidates: priced });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get deck value history (last 90 days)
router.get('/:id/value-history', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    const since = new Date();
    since.setDate(since.getDate() - 90);
    const history = await mongoose.model('DeckValueSnapshot').find({
      deckId: deck._id,
      createdAt: { $gte: since }
    }).sort({ createdAt: 1 });

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get deck change log (last 30 entries)
router.get('/:id/changelog', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    const changelog = await mongoose.model('DeckChange').find({ deckId: deck._id })
      .sort({ createdAt: -1 })
      .limit(30);

    res.json(changelog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/decks/:id/folder — assign deck to a folder (or move to root if folderId is null)
// Body: { folderId: ObjectId|null }
router.put('/:id/folder', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { folderId } = req.body;
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    if (folderId) {
      // Validate the target folder belongs to this user
      const DeckFolder = require('../models/DeckFolder');
      const folder = await DeckFolder.findOne({ _id: folderId, userId });
      if (!folder) return res.status(404).json({ message: 'Folder not found' });
    }

    deck.folderId = folderId || null;
    await deck.save();
    res.json({ _id: deck._id, folderId: deck.folderId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Toggle deck visibility (public/private)
router.patch('/:id/visibility', requireAuth, requireEditor, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });
    if (!deck.shareCode) return res.status(400).json({ message: 'Generate a share link first' });
    if (typeof req.body.isPublic !== 'boolean') {
      return res.status(400).json({ message: 'isPublic must be a boolean' });
    }
    deck.isPublic = req.body.isPublic;
    await deck.save();
    res.json({ isPublic: deck.isPublic, shareCode: deck.shareCode });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Authenticated: import (clone) a community deck into your collection
router.post('/community/:shareCode/import', requireAuth, async (req, res) => {
  try {
    const original = await Deck.findOne({ shareCode: req.params.shareCode }).lean();
    if (!original) return res.status(404).json({ message: 'Deck not found' });

    const userId = getUserId(req);
    const { _id, shareCode, isPublic, importCount, userId: _ownerId, createdAt, updatedAt, __v, folderId, folder, ...deckData } = original;

    const newDeck = new Deck({
      ...deckData,
      userId,
      shareCode: null,
      isPublic: false,
      importCount: 0
    });
    await newDeck.save();

    await Deck.findByIdAndUpdate(original._id, { $inc: { importCount: 1 } });

    res.status(201).json({ deckId: newDeck._id });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Share deck (generate share code)
router.post('/:id/share', requireAuth, requireEditor, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });

    const isFirstShare = !deck.shareCode;
    if (isFirstShare) {
      deck.shareCode = require('crypto').randomBytes(8).toString('hex');
    }
    await deck.save();

    // First-time share: award +3 rep + Deck Builder badge + increment decksShared
    if (isFirstShare) {
      User.findByIdAndUpdate(req.user._id, {
        $inc: { reputation: 3, 'communityStats.decksShared': 1 }
      }).then(() => checkAndAwardBadges(req.user._id, 'deck_share')).catch(() => {});
    }

    res.json({ shareCode: deck.shareCode, shareUrl: `/shared/deck/${deck.shareCode}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
module.exports.injectDependencies = injectDependencies;
