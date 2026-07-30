// Ported verbatim from frontend/src/components/DeckDetail.js:107-127.
// Keep both tables in sync if MTG's meta/salt consensus changes.
const SALTY_CARDS = {
  'Cyclonic Rift': 3, 'Armageddon': 3, 'Winter Orb': 3, 'Static Orb': 3,
  'Stasis': 3, 'Blood Moon': 3, 'Back to Basics': 3, 'Vorinclex, Voice of Hunger': 3,
  'Iona, Shield of Emeria': 3, 'Jin-Gitaxias, Core Augur': 3, 'Expropriate': 3,
  "Thassa's Oracle": 3, 'Demonic Consultation': 3, 'Tergrid, God of Fright': 3,
  'Grand Arbiter Augustin IV': 3, 'Narset, Parter of Veils': 3, 'Hullbreacher': 3,
  'Opposition Agent': 3, 'Drannith Magistrate': 3, 'Rule of Law': 3,
  'Smothering Tithe': 2, 'Rhystic Study': 2, 'Dockside Extortionist': 2,
  'Fierce Guardianship': 2, 'Deflecting Swat': 2, 'Force of Will': 2,
  'Mana Drain': 2, 'Counterspell': 2, 'Pact of Negation': 2,
  'Craterhoof Behemoth': 2, 'Tooth and Nail': 2, 'Triumph of the Hordes': 2,
  'Vorinclex, Monstrous Raider': 2, 'Omniscience': 2, 'Enter the Infinite': 2,
  'Time Stretch': 2, 'Time Warp': 2, 'Extra Turn': 2, 'Seedborn Muse': 2,
  'Consecrated Sphinx': 2, 'Necropotence': 2, 'Ad Nauseam': 2,
  'Sol Ring': 1, 'Mana Crypt': 1, 'Mana Vault': 1, 'Chrome Mox': 1,
  'Mox Diamond': 1, 'Jeweled Lotus': 1, 'Ancient Tomb': 1, "Gaea's Cradle": 1,
  'Strip Mine': 1, 'Wasteland': 1, 'Beast Within': 1,
  'Path to Exile': 1, 'Swords to Plowshares': 1, 'Esper Sentinel': 1,
  'Mystic Remora': 1, 'Demonic Tutor': 1, 'Vampiric Tutor': 1, 'Worldly Tutor': 1,
  'Enlightened Tutor': 1, 'Imperial Seal': 1, 'Gamble': 1,
};

// Ported verbatim from frontend/src/components/DeckDetail.js:129-149.
const POWER_INDICATORS = {
  fastMana: ['Sol Ring', 'Mana Crypt', 'Mana Vault', 'Chrome Mox', 'Mox Diamond',
             'Jeweled Lotus', 'Ancient Tomb', "Gaea's Cradle", 'Lotus Petal',
             'Dark Ritual', 'Cabal Ritual', 'Simian Spirit Guide'],
  tutors: ['Demonic Tutor', 'Vampiric Tutor', 'Worldly Tutor', 'Enlightened Tutor',
           'Mystical Tutor', 'Imperial Seal', 'Gamble', 'Diabolic Intent',
           'Finale of Devastation', "Green Sun's Zenith", 'Chord of Calling',
           'Survival of the Fittest', 'Natural Order', 'Birthing Pod'],
  comboPieces: ["Thassa's Oracle", 'Demonic Consultation', 'Tainted Pact',
                'Laboratory Maniac', 'Jace, Wielder of Mysteries', 'Doomsday',
                'Isochron Scepter', 'Dramatic Reversal', 'Paradox Engine',
                'Basalt Monolith', 'Rings of Brighthearth', 'Power Artifact',
                'Walking Ballista', 'Heliod, Sun-Crowned', 'Spike Feeder',
                'Kiki-Jiki, Mirror Breaker', 'Splinter Twin', 'Zealous Conscripts'],
  efficientRemoval: ['Swords to Plowshares', 'Path to Exile', 'Abrupt Decay',
                     "Assassin's Trophy", 'Force of Will', 'Pact of Negation',
                     'Fierce Guardianship', 'Deflecting Swat', 'Mana Drain'],
  powerhouses: ['Rhystic Study', 'Smothering Tithe', 'Dockside Extortionist',
                'Consecrated Sphinx', 'Necropotence', 'Ad Nauseam', 'Sylvan Library',
                'Mystic Remora', 'Esper Sentinel', 'Seedborn Muse', 'Prophet of Kruphix'],
};

// Ported from frontend/src/components/DeckDetail.js:196-212 (was a useMemo over
// `deck`; here it's a plain function since there's no React lifecycle server-side).
function calculateSaltScore(deck) {
  if (!deck.mainDeck) return { score: 0, cards: [] };
  let totalSalt = 0;
  const saltyCardsInDeck = [];
  deck.mainDeck.forEach(card => {
    const cardSalt = SALTY_CARDS[card.name] || 0;
    if (cardSalt > 0) {
      totalSalt += cardSalt;
      saltyCardsInDeck.push({ name: card.name, salt: cardSalt });
    }
  });
  if (deck.commander && SALTY_CARDS[deck.commander.name]) {
    totalSalt += SALTY_CARDS[deck.commander.name];
    saltyCardsInDeck.push({ name: deck.commander.name, salt: SALTY_CARDS[deck.commander.name] });
  }
  return { score: totalSalt, cards: saltyCardsInDeck.sort((a, b) => b.salt - a.salt) };
}

// Ported from frontend/src/components/DeckDetail.js:215-241 (was a useMemo over
// `deck` and `ownership`; `deckValue` here replaces `ownership?.summary?.totalValue`).
function estimatePowerLevel(deck, deckValue) {
  if (!deck.mainDeck) return { level: 1, breakdown: {} };
  const allCards = deck.mainDeck.map(c => c.name);
  if (deck.commander) allCards.push(deck.commander.name);
  let score = 0;
  const breakdown = {
    fastMana: 0, tutors: 0, comboPieces: 0, efficientRemoval: 0, powerhouses: 0,
    avgCmc: deck.statistics?.avgManaCost || 3.5,
    deckValue: deckValue || 0,
  };
  allCards.forEach(cardName => {
    if (POWER_INDICATORS.fastMana.includes(cardName)) breakdown.fastMana++;
    if (POWER_INDICATORS.tutors.includes(cardName)) breakdown.tutors++;
    if (POWER_INDICATORS.comboPieces.includes(cardName)) breakdown.comboPieces++;
    if (POWER_INDICATORS.efficientRemoval.includes(cardName)) breakdown.efficientRemoval++;
    if (POWER_INDICATORS.powerhouses.includes(cardName)) breakdown.powerhouses++;
  });
  score += Math.min(breakdown.fastMana * 0.5, 2);
  score += Math.min(breakdown.tutors * 0.4, 2);
  score += Math.min(breakdown.comboPieces * 0.6, 2);
  score += Math.min(breakdown.efficientRemoval * 0.3, 1);
  score += Math.min(breakdown.powerhouses * 0.3, 1.5);
  if (breakdown.avgCmc < 2.5) score += 1;
  else if (breakdown.avgCmc < 3) score += 0.5;
  if (breakdown.deckValue > 1000) score += 0.5;
  if (breakdown.deckValue > 2500) score += 0.5;
  return { level: Math.min(10, Math.max(1, Math.round(3 + score))), breakdown };
}

module.exports = { calculateSaltScore, estimatePowerLevel, SALTY_CARDS, POWER_INDICATORS };
