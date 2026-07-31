const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { buildUserQuery } = require('../middleware/multiUser');

router.use(verifyToken);

const THEME_SEARCHES = {
  tokens: 'o:"create" o:"token"',
  graveyard: 'o:"graveyard"',
  counters: 'o:"+1/+1 counter"',
  lifegain: 'o:"gain" o:"life"',
  sacrifice: 'o:"sacrifice"',
  spellslinger: 'o:"instant" o:"sorcery"',
  artifacts: 'o:"artifact"',
  enchantments: 'o:"enchantment"',
  tribal: 'o:"creature" o:"type"',
  ramp: 'o:"add" o:"mana"',
  draw: 'o:"draw" o:"card"',
  control: 'o:"counter" OR o:"destroy"'
};

const THEME_PATTERNS = [
  { name: 'tokens', patterns: [/create.*token/, /token.*creature/] },
  { name: 'graveyard', patterns: [/from.*graveyard/, /into.*graveyard/, /mill/] },
  { name: 'counters', patterns: [/\+1\/\+1 counter/, /proliferate/] },
  { name: 'lifegain', patterns: [/gain.*life/, /lifelink/] },
  { name: 'sacrifice', patterns: [/sacrifice.*creature/, /when.*dies/] },
  { name: 'spellslinger', patterns: [/instant.*sorcery/, /when.*cast.*spell/] },
  { name: 'artifacts', patterns: [/artifact.*enter/, /artifact.*you.*control/] },
  { name: 'enchantments', patterns: [/enchantment.*enter/, /constellation/] },
  { name: 'tribal', patterns: [/creature.*type/, /creatures.*you.*control.*get/] },
  { name: 'ramp', patterns: [/add.*mana/, /search.*land/] },
  { name: 'draw', patterns: [/draw.*card/, /whenever.*draw/] },
  { name: 'control', patterns: [/counter.*spell/, /destroy.*target/, /exile.*target/] }
];

// Only WUBRG letters survive; anything else in the argument is dropped rather
// than rejected outright, so a typo degrades to "no restriction" instead of a 400.
function sanitizeColors(input) {
  if (!input) return '';
  return [...new Set(input.toLowerCase().replace(/[^wubrg]/g, '').split(''))].join('');
}

// GET /api/commanders/recommend?colors=<identity> - ports the collection-analysis
// branch of frontend/src/App.js:265-366 (getCommanderRecommendations), NOT the
// manual "finder" mode (App.js:400+, searchCommandersByPreference).
router.get('/recommend', requireAuth, async (req, res) => {
  try {
    const Card = mongoose.model('Card');
    const cardQuery = buildUserQuery({}, req);
    const cards = await Card.find(cardQuery);

    const themeCounts = {};
    cards.forEach(card => {
      const oracleText = (card.oracleText || '').toLowerCase();
      THEME_PATTERNS.forEach(({ name, patterns }) => {
        if (patterns.some(p => p.test(oracleText))) {
          themeCounts[name] = (themeCounts[name] || 0) + card.quantity;
        }
      });
    });

    const colors = sanitizeColors(req.query.colors);
    const colorQuery = colors ? `id:${colors}` : '';

    const topTheme = Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0];
    const themeQuery = topTheme ? (THEME_SEARCHES[topTheme[0]] || '') : '';

    const searchQuery = `t:legendary t:creature ${colorQuery} ${themeQuery}`.trim();
    try {
      const response = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&order=edhrec&unique=cards`);
      return res.json(response.data.data.slice(0, 20));
    } catch (scryfallError) {
      const fallback = await axios.get('https://api.scryfall.com/cards/search?q=t:legendary+t:creature&order=edhrec&unique=cards');
      return res.json(fallback.data.data.slice(0, 20));
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
