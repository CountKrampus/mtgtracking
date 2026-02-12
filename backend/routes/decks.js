const express = require('express');
const router = express.Router();
const axios = require('axios');
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

function injectDependencies(cardModel, priceFunction) {
  Card = cardModel;
  getPriceWithFallback = priceFunction;
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

    const { userId: _, ...updateData } = req.body;
    Object.assign(deck, updateData);
    deck.statistics = calculateDeckStatistics(deck);
    await deck.save();
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
        // Fetch current price if getPriceWithFallback is available
        let price = 0;
        if (getPriceWithFallback) {
          try {
            const priceData = await getPriceWithFallback(deckCard.name);
            price = priceData.usd;
          } catch (error) {
            console.error(`Error fetching price for ${deckCard.name}:`, error.message);
          }
        }

        missingCards.push({
          ...deckCard.toObject ? deckCard.toObject() : deckCard,
          price
        });
        missingValue += price;
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
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

module.exports = router;
module.exports.injectDependencies = injectDependencies;
