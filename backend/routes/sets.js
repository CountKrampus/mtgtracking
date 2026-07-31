const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { buildUserQuery } = require('../middleware/multiUser');
const { cachedApiCall } = require('../utils/apiCache');

router.use(verifyToken);

// GET /api/sets/completion - ports frontend/src/App.js:463-522 (getSetCompletionData)
router.get('/completion', requireAuth, async (req, res) => {
  try {
    const Card = mongoose.model('Card');
    const cardQuery = buildUserQuery({}, req);
    const cards = await Card.find(cardQuery);

    const cardsBySet = {};
    cards.forEach(card => {
      if (card.setCode) {
        const code = card.setCode.toLowerCase();
        if (!cardsBySet[code]) {
          cardsBySet[code] = { setCode: code, ownedCards: new Set(), totalOwned: 0 };
        }
        cardsBySet[code].ownedCards.add(card.name);
        cardsBySet[code].totalOwned += card.quantity;
      }
    });

    const completionData = [];
    const setCodes = Object.keys(cardsBySet);

    for (const code of setCodes.slice(0, 20)) {
      try {
        // The 100ms delay only runs on a cache miss (real Scryfall request) -
        // cache hits return instantly, but a cold cache with many owned sets
        // still respects Scryfall's requested spacing between requests.
        const setInfo = await cachedApiCall(`scryfall-set:${code}`, async () => {
          const setResponse = await axios.get(`https://api.scryfall.com/sets/${code}`);
          await new Promise(resolve => setTimeout(resolve, 100));
          return setResponse.data;
        });
        completionData.push({
          setCode: code.toUpperCase(),
          setName: setInfo.name,
          ownedUnique: cardsBySet[code].ownedCards.size,
          totalInSet: setInfo.card_count,
          totalOwned: cardsBySet[code].totalOwned,
          releasedAt: setInfo.released_at,
          setType: setInfo.set_type
        });
      } catch (e) {
        // Skip sets Scryfall can't find - matches frontend behavior at App.js:508-511
      }
    }

    completionData.sort((a, b) => (b.ownedUnique / b.totalInSet) - (a.ownedUnique / a.totalInSet));
    res.json(completionData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
