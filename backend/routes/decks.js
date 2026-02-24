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
  parseArchidektURL
} = require('../utils/deckHelpers');
const { requireAuth, requireEditor } = require('../middleware/auth');
const { buildUserQuery, getUserId } = require('../middleware/multiUser');
const { activityLoggers } = require('../middleware/activityLogger');

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

// Get single deck
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const deck = await Deck.findOne(query);
    if (!deck) return res.status(404).json({ message: 'Deck not found' });
    res.json(deck);
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
    const identifiers = parsedData.mainDeck.map(card => ({ name: card.name }));
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

    const mainDeck = allScryfallCards.map((scryfallCard, idx) => ({
      scryfallId: scryfallCard.id,
      name: scryfallCard.name,
      manaCost: scryfallCard.mana_cost,
      types: scryfallCard.type_line?.split('—')?.[0]?.trim().split(' ') || [],
      colors: scryfallCard.colors || [],
      imageUrl: scryfallCard.image_uris?.normal,
      quantity: parsedData.mainDeck[idx]?.quantity || 1
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

    const allDeckCards = [
      deck.commander,
      ...(deck.partnerCommander ? [deck.partnerCommander] : []),
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
          price: 0
        });
      }
    }

    res.json({
      ownedCards,
      missingCards,
      summary: {
        ownedCount: ownedCards.length,
        missingCount: missingCards.length,
        ownedValue: Math.round(ownedValue * 100) / 100,
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

    if (!GameSession) {
      return res.json({ gamesPlayed: 0, wins: 0, winRate: 0, avgPlacement: 0, avgTurns: 0, avgDuration: 0, bestMatchups: [], worstMatchups: [] });
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
      worstMatchups
    });
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

module.exports = router;
module.exports.injectDependencies = injectDependencies;
