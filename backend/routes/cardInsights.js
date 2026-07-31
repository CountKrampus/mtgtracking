const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { buildUserQuery } = require('../middleware/multiUser');

router.use(verifyToken);

// GET /api/cards/:id/similar - ports frontend/src/components/CollectionView.js:551-570
router.get('/:id/similar', requireAuth, async (req, res) => {
  try {
    const Card = mongoose.model('Card');
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const queries = [];
    if (card.types?.length > 0) queries.push(`t:${card.types[0].toLowerCase()}`);
    if (card.colors?.length > 0) queries.push(`(${card.colors.map(c => `c:${c.toLowerCase()}`).join(' ')})`);
    else queries.push('c:colorless');
    queries.push(`-!"${card.name}"`);

    try {
      const response = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(queries.join(' '))}&order=edhrec&unique=cards`);
      return res.json(response.data.data.slice(0, 20));
    } catch (scryfallError) {
      if (card.types?.length > 0) {
        const fallback = await axios.get(`https://api.scryfall.com/cards/search?q=t:${card.types[0].toLowerCase()}&order=edhrec&unique=cards`);
        return res.json(fallback.data.data.slice(0, 20));
      }
      return res.json([]);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/cards/:id/synergies - ports frontend/src/components/CollectionView.js:590-690
const TRIBE_PATTERN = /\b(Elf|Goblin|Zombie|Human|Vampire|Dragon|Angel|Demon|Merfolk|Wizard|Warrior|Knight|Soldier|Beast|Elemental|Spirit|Dinosaur|Pirate|Cat|Dog|Bird|Snake|Spider|Rat|Wolf|Bear|Sliver|Ally|Cleric|Rogue|Shaman|Druid|Artifact|Enchantment)\b/gi;
const NAME_TRIBE_PATTERN = /\b(Elf|Goblin|Zombie|Human|Vampire|Dragon|Angel|Demon|Merfolk|Wizard|Warrior|Knight|Soldier|Beast|Elemental|Spirit|Dinosaur|Pirate|Cat|Dog|Bird|Snake|Spider|Rat|Wolf|Bear|Sliver|Ally|Cleric|Rogue|Shaman|Druid)\b/gi;

const KEYWORD_PATTERNS = [
  { keyword: 'flying', search: 'o:"flying" OR o:"creatures with flying"' },
  { keyword: 'deathtouch', search: 'o:"deathtouch"' },
  { keyword: 'lifelink', search: 'o:"lifelink" OR o:"whenever you gain life"' },
  { keyword: 'trample', search: 'o:"trample"' },
  { keyword: 'haste', search: 'o:"haste"' },
  { keyword: 'vigilance', search: 'o:"vigilance"' },
  { keyword: 'first strike', search: 'o:"first strike" OR o:"double strike"' },
  { keyword: 'hexproof', search: 'o:"hexproof"' },
  { keyword: 'indestructible', search: 'o:"indestructible"' },
  { keyword: 'menace', search: 'o:"menace"' },
  { keyword: 'reach', search: 'o:"reach"' },
  { keyword: 'flash', search: 'o:"flash"' },
  { keyword: 'prowess', search: 'o:"prowess" OR o:"whenever you cast a noncreature"' },
  { keyword: 'ward', search: 'o:"ward"' },
];

const MECHANIC_PATTERNS = [
  { pattern: /\+1\/\+1 counter/i, search: 'o:"+1/+1 counter" OR o:"proliferate"' },
  { pattern: /-1\/-1 counter/i, search: 'o:"-1/-1 counter" OR o:"wither"' },
  { pattern: /draw.*(card|cards)/i, search: 'o:"whenever you draw" OR o:"draw a card"' },
  { pattern: /discard/i, search: 'o:"discard" o:"whenever"' },
  { pattern: /creature dies|when.*dies/i, search: 'o:"when" o:"dies" OR o:"whenever a creature dies"' },
  { pattern: /sacrifice/i, search: 'o:"sacrifice" o:"whenever" OR o:"sacrifice a creature"' },
  { pattern: /token/i, search: 'o:"create" o:"token"' },
  { pattern: /graveyard/i, search: 'o:"from your graveyard" OR o:"in your graveyard"' },
  { pattern: /exile/i, search: 'o:"exile" o:"return"' },
  { pattern: /enters the battlefield|etb/i, search: 'o:"enters the battlefield" o:"whenever"' },
  { pattern: /life.*gain|gain.*life/i, search: 'o:"gain life" OR o:"whenever you gain life"' },
  { pattern: /deals.*damage.*opponent/i, search: 'o:"deals damage to" o:"opponent"' },
  { pattern: /mana/i, search: 'o:"add" o:"mana"' },
  { pattern: /equipment|equip/i, search: 't:equipment OR o:"equipped creature"' },
  { pattern: /aura|enchant creature/i, search: 't:aura OR o:"enchanted creature"' },
  { pattern: /spell.*cast|cast.*spell/i, search: 'o:"whenever you cast" o:"spell"' },
  { pattern: /attack/i, search: 'o:"whenever" o:"attacks"' },
  { pattern: /untap/i, search: 'o:"untap" o:"whenever"' },
  { pattern: /copy/i, search: 'o:"copy" o:"spell" OR o:"copy" o:"creature"' },
];

router.get('/:id/synergies', requireAuth, async (req, res) => {
  try {
    const Card = mongoose.model('Card');
    const query = buildUserQuery({ _id: req.params.id }, req);
    const card = await Card.findOne(query);
    if (!card) return res.status(404).json({ message: 'Card not found' });

    const results = { tribal: [], keywords: [], mechanics: [] };
    const colorQuery = card.colors?.length > 0 ? `id<=${card.colors.map(c => c[0].toLowerCase()).join('')}` : 'id:c';

    if (card.types?.some(t => t.toLowerCase() === 'creature')) {
      const ot = card.oracleText || '';
      const typeMatch = ot.match(TRIBE_PATTERN);
      const nameTypes = card.name.match(NAME_TRIBE_PATTERN);
      const tribes = [...new Set([...(typeMatch || []), ...(nameTypes || [])])].map(t => t.toLowerCase());
      if (tribes.length > 0) {
        const tribe = tribes[0];
        try {
          const r = await axios.get(`https://api.scryfall.com/cards/search?q=o:"${tribe}" ${colorQuery} -t:${tribe} -!"${card.name}"&order=edhrec&unique=cards`);
          results.tribal = r.data.data.slice(0, 12);
        } catch (e) {
          try {
            const r2 = await axios.get(`https://api.scryfall.com/cards/search?q=t:${tribe} ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
            results.tribal = r2.data.data.slice(0, 12);
          } catch (e2) { /* no tribal results */ }
        }
      }
    }

    const ot = (card.oracleText || '').toLowerCase();
    const foundKeywords = KEYWORD_PATTERNS.filter(({ keyword }) => ot.includes(keyword));
    if (foundKeywords.length > 0) {
      try {
        const r = await axios.get(`https://api.scryfall.com/cards/search?q=(${foundKeywords[0].search}) ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
        results.keywords = r.data.data.slice(0, 12);
      } catch (e) { /* no keyword results */ }
    }

    const foundMechanics = MECHANIC_PATTERNS.filter(({ pattern }) => pattern.test(ot));
    if (foundMechanics.length > 0) {
      try {
        const r = await axios.get(`https://api.scryfall.com/cards/search?q=(${foundMechanics[0].search}) ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
        results.mechanics = r.data.data.slice(0, 12);
      } catch (e) { /* no mechanic results */ }
    }

    if (results.mechanics.length === 0) {
      try {
        if (card.types?.includes('Instant') || card.types?.includes('Sorcery')) {
          const r = await axios.get(`https://api.scryfall.com/cards/search?q=o:"whenever you cast" (o:"instant" OR o:"sorcery") ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
          results.mechanics = r.data.data.slice(0, 12);
        } else if (card.types?.includes('Artifact')) {
          const r = await axios.get(`https://api.scryfall.com/cards/search?q=o:"artifact" o:"whenever" ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
          results.mechanics = r.data.data.slice(0, 12);
        } else if (card.types?.includes('Enchantment')) {
          const r = await axios.get(`https://api.scryfall.com/cards/search?q=o:"enchantment" o:"whenever" OR o:"constellation" ${colorQuery} -!"${card.name}"&order=edhrec&unique=cards`);
          results.mechanics = r.data.data.slice(0, 12);
        }
      } catch (e) { /* no fallback mechanic results */ }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
