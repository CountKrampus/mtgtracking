// backend/routes/cards.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken, requireAuth, requireEditor } = require('../middleware/auth');
const { buildUserQuery, getUserId } = require('../middleware/multiUser');
const { activityLoggers } = require('../middleware/activityLogger');
const { getPriceWithFallback } = require('../utils/pricing');
const { getFromCache, setInCache, clearCache } = require('../utils/statsCache');
const { cacheCardImage } = require('../utils/imageCache');
const { fetchCardFromScryfall } = require('../utils/scryfallLookup');
const Card = require('../models/Card');
const CardPriceSnapshot = require('../models/CardPriceSnapshot');
const CardPriceHistory = require('../models/CardPriceHistory');
const { parseCardLine, getDuplicateCardQuery, validateCardPayload, validateBulkUpdatePayload, buildCardListQuery, normalizeTag, findDuplicateGroups, applyMerge } = require('../utils/cardUtils');

router.use(verifyToken);


// Get all cards
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { query, sort, pagination } = buildCardListQuery(req);

    if (!pagination.enabled) {
      const cached = getFromCache('cards', userId);
      if (cached) {
        return res.json(cached);
      }
    }

    const cardQuery = Card.find(query).sort(sort);
    let result;

    if (pagination.enabled) {
      const [cards, total] = await Promise.all([
        cardQuery.skip(pagination.skip).limit(pagination.limit).exec(),
        Card.countDocuments(query)
      ]);

      result = {
        cards,
        total,
        page: pagination.page,
        limit: pagination.limit
      };
    } else {
      const cards = await cardQuery.exec();
      setInCache('cards', userId, cards);
      result = cards;
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Find duplicate rows: exact duplicates plus Unknown-set merge suggestions
router.get('/duplicates', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({}, req);
    const cards = await Card.find(query).sort({ createdAt: 1 }).lean();
    res.json(findDuplicateGroups(cards));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Merge duplicate rows into a target card, deleting the sources
router.post('/merge-duplicates', requireAuth, requireEditor, activityLoggers.cardMerge, async (req, res) => {
  try {
    const { targetId, sourceIds } = req.body;
    if (!targetId || !Array.isArray(sourceIds) || sourceIds.length === 0) {
      return res.status(400).json({ message: 'targetId and a non-empty sourceIds array are required' });
    }
    if (sourceIds.includes(targetId)) {
      return res.status(400).json({ message: 'targetId cannot be one of sourceIds' });
    }

    const userId = getUserId(req);
    const target = await Card.findOne(buildUserQuery({ _id: targetId }, req));
    if (!target) return res.status(404).json({ message: 'Target card not found' });

    const sources = await Card.find(buildUserQuery({ _id: { $in: sourceIds } }, req));
    if (sources.length !== sourceIds.length) {
      return res.status(404).json({ message: 'One or more source cards not found' });
    }

    const mismatched = sources.find(s =>
      s.name !== target.name ||
      s.condition !== target.condition ||
      Boolean(s.isFoil) !== Boolean(target.isFoil)
    );
    if (mismatched) {
      return res.status(400).json({ message: 'All cards in a merge must match on name, condition, and foil status' });
    }

    applyMerge(target, sources);
    await target.save();
    // Not run in a transaction (no other multi-step mutation in this file uses
    // one either) - if deleteMany fails after save succeeds, the target keeps
    // its merged quantity and the sources survive too, so re-running the merge
    // is idempotent-ish but would double the sources' quantity into the target.
    await Card.deleteMany({ _id: { $in: sources.map(s => s._id) } });

    clearCache(userId);
    res.json({ merged: true, target, removedCount: sources.length });
  } catch (error) {
    // Backfilling an empty target field (e.g. collectorNumber) from a source
    // can, in rare hand-edited-data cases, make the target's new unique-index
    // key collide with some other untouched card - surface that as a normal
    // 400 rather than a generic 500. The source rows are untouched (this
    // failure happens on target.save(), before any deleteMany runs).
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Merging these cards would create a duplicate of another card in your collection' });
    }
    res.status(500).json({ message: error.message });
  }
});

// Get single card
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });
    res.json(card);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update prices from Scryfall (with MTGGoldfish backup)
router.post('/:id/update-price', requireAuth, requireEditor, activityLoggers.priceUpdate, async (req, res) => {
  try {
    const { force, fullData } = req.query; // Optional: force update, fullData for complete card info
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    // Capture price before update for lastPrice tracking
    const oldPrice = card.price;

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
        card.types = cardData.type_line ? cardData.type_line.split('â€”')[0].trim().split(' ') : [];
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

    // Track price change: store old price in lastPrice if price changed
    if (oldPrice > 0 && card.price !== oldPrice) {
      card.lastPrice = oldPrice;
    }

    await card.save();

    // Save daily price snapshot for this card
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const existingSnap = await CardPriceSnapshot.findOne({ cardId: card._id, createdAt: { $gte: todayStart } });
      if (!existingSnap) {
        const snapData = { cardId: card._id, price: card.price };
        if (req.userId) snapData.userId = req.userId;
        await CardPriceSnapshot.create(snapData);
      }
    } catch {
      // Non-critical: don't fail if snapshot fails
    }

    const userId = getUserId(req);
    clearCache(userId);

    res.json(card);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk update all prices from Scryfall (with MTGGoldfish backup)
router.post('/update-all-prices', requireAuth, requireEditor, activityLoggers.priceBulkUpdate, async (req, res) => {
  try {
    const { force, fullData } = req.query; // Optional: force update, fullData for complete card info
    const cardQuery = buildUserQuery({}, req);
    const cards = await Card.find(cardQuery);
    let updated = 0;
    let skipped = 0;

    for (const card of cards) {
      try {
        // Capture price before update for lastPrice tracking
        const oldPrice = card.price;

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

            // Pricing is already included in cardData - reuse it instead of a
            // second Scryfall round-trip. Only fall through to the MTGGoldfish
            // backup (via getPriceWithFallback) if Scryfall itself has no price.
            const scryfallPrice = card.isFoil
              ? (cardData.prices?.usd_foil ? parseFloat(cardData.prices.usd_foil) : 0)
              : (cardData.prices?.usd ? parseFloat(cardData.prices.usd) : 0);
            const priceData = scryfallPrice > 0
              ? { usd: scryfallPrice }
              : await getPriceWithFallback(card.name, card.isFoil);

            // Cache image and get local URL
            const scryfallImageUrl = cardData.image_uris ? cardData.image_uris.normal : null;
            const cachedImageUrl = await cacheCardImage(cardData.id, scryfallImageUrl);

            // Update all card fields with Scryfall data
            card.set = cardData.set_name;
            card.setCode = cardData.set.toUpperCase();
            card.collectorNumber = cardData.collector_number;
            card.rarity = cardData.rarity[0].toUpperCase();
            card.colors = cardData.colors || [];
            card.types = cardData.type_line ? cardData.type_line.split('â€”')[0].trim().split(' ') : [];
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

        // Track price change: store old price in lastPrice if price changed
        if (oldPrice > 0 && card.price !== oldPrice) {
          card.lastPrice = oldPrice;
        }

        await card.save();
        updated++;

        // Save daily price snapshot for this card
        try {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const existingSnap = await CardPriceSnapshot.findOne({ cardId: card._id, createdAt: { $gte: todayStart } });
          if (!existingSnap) {
            const snapData = { cardId: card._id, price: card.price };
            if (req.userId) snapData.userId = req.userId;
            await CardPriceSnapshot.create(snapData);
          }
        } catch {
          // Non-critical
        }

        // Rate limiting - be respectful to servers. Lowered from 500ms since
        // the fullData path now makes ~1 Scryfall call per card instead of ~2
        // (price is read from the already-fetched cardData, see above).
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error updating ${card.name}:`, error.message);
      }
    }

    // Clear cache if any cards were updated
    if (updated > 0) {
      const userId = getUserId(req);
      clearCache(userId);
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
router.post('/bulk-import', requireAuth, requireEditor, activityLoggers.cardBulkImport, async (req, res) => {
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
              types: cardData.type_line ? cardData.type_line.split('â€”')[0].trim().split(' ') : [],
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

        const query = getDuplicateCardQuery(cardInfo, req);
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

    // Clear cache if any cards were added or merged
    if (results.added.length > 0 || results.merged.length > 0 || results.offline.length > 0) {
      clearCache(userId);
      // Non-blocking milestone check once after all cards are imported
      if (userId) {
        const { checkCollectionMilestones } = require('../utils/milestoneAwards');
        checkCollectionMilestones(userId, Card).catch(() => {});
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk import full card data (for JSON/CSV imports)
router.post('/bulk-import-full', requireAuth, requireEditor, activityLoggers.cardBulkImport, async (req, res) => {
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

        const existingQuery = getDuplicateCardQuery(cardInfo, req);
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

    // Clear cache if any cards were added or merged
    if (results.added.length > 0 || results.merged.length > 0) {
      clearCache(userId);
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Offline-only bulk import (no API calls)
router.post('/bulk-import-offline', requireAuth, requireEditor, activityLoggers.cardBulkImport, async (req, res) => {
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

        const existingQuery = getDuplicateCardQuery(cardInfo, req);
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

    // Clear cache if any cards were added or merged
    if (results.added.length > 0 || results.merged.length > 0) {
      clearCache(userId);
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new card (or merge with existing if duplicate)
router.post('/', requireAuth, requireEditor, activityLoggers.cardCreate, async (req, res) => {
  try {
    const userId = getUserId(req);
    const errors = validateCardPayload(req.body);
    if (errors.length) {
      return res.status(400).json({ message: 'Invalid card payload', errors });
    }

    const { quantity, isFoil } = req.body;
    const existingQuery = getDuplicateCardQuery(req.body, req);
    const existingCard = await Card.findOne(existingQuery);

    if (existingCard) {
      // Card exists - increment quantity instead of creating duplicate
      existingCard.quantity += quantity || 1;
      const updatedCard = await existingCard.save();
      clearCache(userId);
      // Non-blocking milestone check after merge
      if (userId) {
        const { checkCollectionMilestones } = require('../utils/milestoneAwards');
        checkCollectionMilestones(userId, Card).catch(() => {});
      }
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
    clearCache(userId);
    // Non-blocking milestone check after card creation
    if (newCard.userId) {
      const { checkCollectionMilestones } = require('../utils/milestoneAwards');
      checkCollectionMilestones(newCard.userId, Card).catch(() => {});
    }
    res.status(201).json(newCard);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update card
router.put('/:id', requireAuth, requireEditor, activityLoggers.cardUpdate, async (req, res) => {
  try {
    const userId = getUserId(req);
    const errors = validateCardPayload(req.body, { allowPartial: true });
    if (errors.length) {
      return res.status(400).json({ message: 'Invalid card payload', errors });
    }

    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    // Don't allow changing userId
    const { userId: _, ...updateData } = req.body;
    Object.assign(card, updateData);
    const updatedCard = await card.save();

    // Record price history point for trend tracking
    if (updatedCard.price > 0) {
      try {
        await CardPriceHistory.create({
          cardId: updatedCard._id,
          userId: userId,
          price: updatedCard.price
        });
      } catch (histErr) {
        console.error('Error recording price history:', histErr.message);
      }
    }

    clearCache(userId);
    // Non-blocking milestone check after card update (quantity may have changed)
    if (updatedCard.userId) {
      const { checkCollectionMilestones } = require('../utils/milestoneAwards');
      checkCollectionMilestones(updatedCard.userId, Card).catch(() => {});
    }
    res.json(updatedCard);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete card
router.delete('/:id', requireAuth, requireEditor, activityLoggers.cardDelete, async (req, res) => {
  try {
    const userId = getUserId(req);
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    await card.deleteOne();
    clearCache(userId);
    res.json({ message: 'Card deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get price history for a specific card
router.get('/:id/price-history', requireAuth, async (req, res) => {
  try {
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const days = Math.max(1, Math.min(parseInt(req.query.days) || 90, 365));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const snapshots = await CardPriceSnapshot.find({
      cardId: card._id,
      createdAt: { $gte: startDate }
    }).sort({ createdAt: 1 }).lean();

    // Also include points recorded via CardPriceHistory (e.g. on card edits)
    const historyPoints = await CardPriceHistory.find({
      cardId: card._id,
      date: { $gte: startDate }
    }).sort({ date: 1 }).lean();

    // Normalize to a unified { price, date } shape and merge chronologically
    const merged = [
      ...snapshots.map(s => ({ ...s, date: s.createdAt })),
      ...historyPoints
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json(merged);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a card's finance fields (buylist/sell values, price alert)
router.put('/:id/finance', requireAuth, requireEditor, async (req, res) => {
  try {
    const { buylistValue, sellValue, priceAlert } = req.body;
    const userId = getUserId(req);
    const card = await Card.findOne(buildUserQuery({ _id: req.params.id }, req));

    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }

    if (buylistValue !== undefined) card.buylistValue = buylistValue;
    if (sellValue !== undefined) card.sellValue = sellValue;
    if (priceAlert !== undefined) card.priceAlert = priceAlert;

    await card.save();
    clearCache(userId);

    res.json(card);
  } catch (err) {
    res.status(500).json({ message: 'Error updating card finance', error: err.message });
  }
});

// Add tag to a card
router.post('/:id/tags', requireAuth, requireEditor, async (req, res) => {
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
router.delete('/:id/tags/:tag', requireAuth, requireEditor, async (req, res) => {
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

// Bulk update oracle text for existing cards (one-time migration/backfill)
router.post('/update-all-oracle-text', requireAuth, requireEditor, async (req, res) => {
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
router.post('/migrate-images-to-cache', requireAuth, requireEditor, async (req, res) => {
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

// Bulk update multiple cards
router.post('/bulk-update', requireAuth, requireEditor, activityLoggers.cardBulkUpdate, async (req, res) => {
  try {
    const userId = getUserId(req);
    const errors = validateBulkUpdatePayload(req.body);
    if (errors.length) {
      return res.status(400).json({ message: 'Invalid bulk update payload', errors });
    }

    const { cardIds, updates } = req.body;

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

    if (updatedCount > 0) {
      clearCache(userId);
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
router.delete('/bulk-delete', requireAuth, requireEditor, activityLoggers.cardBulkDelete, async (req, res) => {
  try {
    const userId = getUserId(req);
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

    if (deletedCount > 0) {
      clearCache(userId);
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

module.exports = router;

