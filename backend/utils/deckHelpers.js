const axios = require('axios');

// Calculate mana cost from mana cost string
function parseCMC(manaCost) {
  if (!manaCost) return 0;
  let cmc = 0;
  const matches = manaCost.match(/\{([^}]+)\}/g) || [];
  matches.forEach(symbol => {
    const value = symbol.replace(/[{}]/g, '');
    if (/^\d+$/.test(value)) {
      cmc += parseInt(value);
    } else if (value !== 'X') {
      cmc += 1; // Each colored/hybrid symbol = 1
    }
  });
  return cmc;
}

// Extract colors from mana cost
function extractColorsFromManaCost(manaCost) {
  if (!manaCost) return [];
  const colorMap = { W: 'W', U: 'U', B: 'B', R: 'R', G: 'G' };
  const colors = new Set();

  Object.keys(colorMap).forEach(color => {
    if (manaCost.includes(color)) colors.add(color);
  });

  if (colors.size === 0 && manaCost) colors.add('C');
  return Array.from(colors);
}

// Update statistics for a single card
function updateStatsForCard(stats, card, quantity) {
  // Mana curve
  const cmc = parseCMC(card.manaCost);
  const bucket = cmc >= 7 ? '7+' : cmc.toString();
  stats.manaCurve[bucket] = (stats.manaCurve[bucket] || 0) + quantity;

  // Colors (from mana cost)
  extractColorsFromManaCost(card.manaCost).forEach(color => {
    stats.colorDistribution[color] = (stats.colorDistribution[color] || 0) + quantity;
  });

  // Types
  (card.types || []).forEach(type => {
    if (stats.typeDistribution[type] !== undefined) {
      stats.typeDistribution[type] += quantity;
    }
  });
}

// Calculate deck statistics
function calculateDeckStatistics(deck) {
  const stats = {
    totalCards: 0,
    manaCurve: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 },
    colorDistribution: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    typeDistribution: {
      Creature: 0,
      Instant: 0,
      Sorcery: 0,
      Artifact: 0,
      Enchantment: 0,
      Planeswalker: 0,
      Land: 0
    },
    avgManaCost: 0
  };

  let totalCMC = 0;
  let nonLandCards = 0;

  // Process commander(s)
  [deck.commander, deck.partnerCommander].filter(Boolean).forEach(cmd => {
    updateStatsForCard(stats, cmd, 1);
    const cmc = parseCMC(cmd.manaCost);
    totalCMC += cmc;
    nonLandCards++;
  });

  // Process main deck
  deck.mainDeck.forEach(card => {
    const quantity = card.quantity || 1;
    stats.totalCards += quantity;
    updateStatsForCard(stats, card, quantity);

    if (!card.types?.includes('Land')) {
      totalCMC += parseCMC(card.manaCost) * quantity;
      nonLandCards += quantity;
    }
  });

  stats.totalCards += 1 + (deck.partnerCommander ? 1 : 0);
  stats.avgManaCost = nonLandCards > 0 ? Math.round((totalCMC / nonLandCards) * 100) / 100 : 0;

  return stats;
}

// Validate Commander deck rules
function validateDeck(deck) {
  const errors = [];
  const warnings = [];
  const basicLands = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'];

  // 1. Card count (100 exactly)
  const totalCards = 1 + (deck.partnerCommander ? 1 : 0) +
                     deck.mainDeck.reduce((sum, card) => sum + (card.quantity || 1), 0);
  if (totalCards !== 100) {
    errors.push(`Deck must have exactly 100 cards (currently ${totalCards})`);
  }

  // 2. Singleton rule
  const cardCounts = {};
  deck.mainDeck.forEach(card => {
    if (!basicLands.includes(card.name)) {
      cardCounts[card.name] = (cardCounts[card.name] || 0) + (card.quantity || 1);
      if (cardCounts[card.name] > 1) {
        errors.push(`${card.name}: Only 1 copy allowed (found ${cardCounts[card.name]})`);
      }
    }
  });

  // 3. Color identity
  const commanderIdentity = new Set([
    ...(deck.commander?.colorIdentity || []),
    ...(deck.partnerCommander?.colorIdentity || [])
  ]);

  deck.mainDeck.forEach(card => {
    // For MVP, check if card colors are subset of commander identity
    const cardColors = card.colors || [];
    const violatesIdentity = cardColors.some(c => !commanderIdentity.has(c) && commanderIdentity.size > 0);
    if (violatesIdentity) {
      warnings.push(`${card.name}: May violate color identity (${cardColors.join('')} vs commander ${Array.from(commanderIdentity).join('')})`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

// Parse plain text deck list
function parseTextList(text) {
  // Handle Windows line endings
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(line => line.trim());
  let commander = null;
  let partnerCommander = null;
  const mainDeck = [];
  let isCommanderSection = false;

  for (const line of lines) {
    if (/commander:/i.test(line)) {
      isCommanderSection = true;
      continue;
    }
    if (/deck:|main:|mainboard:/i.test(line)) {
      isCommanderSection = false;
      continue;
    }

    const match = line.match(/^(\d+)?\s*(.+?)(\s*\*CMDR\*)?$/);
    if (!match) continue;

    const quantity = parseInt(match[1]) || 1;
    let cardName = match[2].trim();
    const isCommander = match[3] || isCommanderSection;

    // Remove set codes
    cardName = cardName.replace(/\s*\([A-Z0-9]+\)\s*[A-Z0-9\-]*$/i, '').trim();

    if (isCommander) {
      if (!commander) commander = cardName;
      else if (!partnerCommander) partnerCommander = cardName;
    } else {
      mainDeck.push({ name: cardName, quantity });
    }
  }

  return { commander, partnerCommander, mainDeck };
}

// Parse Moxfield URL
async function parseMoxfieldURL(url) {
  const deckId = url.match(/moxfield\.com\/decks\/([^\/\?]+)/)?.[1];
  if (!deckId) throw new Error('Invalid Moxfield URL');

  // Try the public download endpoint first (less likely to be blocked)
  try {
    const downloadResponse = await axios.get(`https://www.moxfield.com/decks/${deckId}/download`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      maxRedirects: 5
    });

    // Parse the text format (each line is "quantity cardname")
    const lines = downloadResponse.data.split('\n').filter(line => line.trim());
    const mainDeck = [];
    let deckName = 'Imported Moxfield Deck';

    for (const line of lines) {
      // Skip section headers like "// Commander" or "// Sideboard"
      if (line.startsWith('//')) {
        if (line.includes('Deck')) {
          deckName = line.replace('//', '').trim();
        }
        continue;
      }

      const match = line.match(/^(\d+)\s+(.+)$/);
      if (match) {
        mainDeck.push({
          name: match[2].trim(),
          quantity: parseInt(match[1])
        });
      }
    }

    return {
      name: deckName,
      description: '',
      commander: null,
      partnerCommander: null,
      mainDeck
    };
  } catch (downloadError) {
    // If download fails, try the API (may be blocked by Cloudflare)
    try {
      const response = await axios.get(`https://api2.moxfield.com/v2/decks/all/${deckId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.moxfield.com/',
          'Origin': 'https://www.moxfield.com',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site'
        }
      });
      const data = response.data;

      return {
        name: data.name,
        description: data.description || '',
        commander: data.commanders?.[0]?.card?.name,
        partnerCommander: data.commanders?.[1]?.card?.name,
        mainDeck: Object.values(data.mainboard || {}).map(card => ({
          name: card.card.name,
          quantity: card.quantity
        }))
      };
    } catch (apiError) {
      throw new Error('Moxfield is blocking automated requests. Please export your deck from Moxfield (click Export → Text) and import using a .txt file instead.');
    }
  }
}

// Parse Archidekt URL
async function parseArchidektURL(url) {
  const deckId = url.match(/archidekt\.com\/decks\/(\d+)/)?.[1];
  if (!deckId) throw new Error('Invalid Archidekt URL');

  // Add browser-like headers to bypass potential bot protection
  const response = await axios.get(`https://archidekt.com/api/decks/${deckId}/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.archidekt.com/',
      'Origin': 'https://www.archidekt.com',
      'DNT': '1',
      'Connection': 'keep-alive'
    }
  });
  const data = response.data;

  const commanders = data.cards.filter(c => c.categories.includes('Commander'));
  const mainboard = data.cards.filter(c => !c.categories.includes('Commander'));

  return {
    name: data.name,
    description: data.description || '',
    commander: commanders[0]?.card?.oracleCard?.name,
    partnerCommander: commanders[1]?.card?.oracleCard?.name,
    mainDeck: mainboard.map(card => ({
      name: card.card.oracleCard.name,
      quantity: card.quantity
    }))
  };
}

module.exports = {
  parseCMC,
  extractColorsFromManaCost,
  calculateDeckStatistics,
  validateDeck,
  parseTextList,
  parseMoxfieldURL,
  parseArchidektURL
};
