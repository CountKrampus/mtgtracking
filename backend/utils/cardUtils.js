const { buildUserQuery } = require('../middleware/multiUser');

const VALID_CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

function normalizeTag(tag) {
  return typeof tag === 'string' ? tag.toLowerCase().trim() : tag;
}

function parseCardLine(line) {
  const qtyMatch = line.trim().match(/^([0-9]+)\s+(.+)$/);
  let quantity = 1;
  let rest = line.trim();
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1], 10);
    rest = qtyMatch[2];
  }

  const result = {
    cardName: rest,
    quantity,
    setCode: null,
    collectorNumber: null,
    rarity: null
  };

  const fullMatch = rest.match(/^(.+?)\s*\(([CURMLS])\s+([A-Z0-9]+)\s+([A-Z0-9]+)\)\s*$/i);
  if (fullMatch) {
    result.cardName = fullMatch[1].trim();
    result.rarity = fullMatch[2].toUpperCase();
    result.collectorNumber = fullMatch[3];
    result.setCode = fullMatch[4].toUpperCase();
    return result;
  }

  const setCollectorMatch = rest.match(/^(.+?)\s*\(([A-Z0-9]+)\)\s+([A-Z0-9\-]+)\s*$/i);
  if (setCollectorMatch) {
    result.cardName = setCollectorMatch[1].trim();
    result.setCode = setCollectorMatch[2].toUpperCase();
    result.collectorNumber = setCollectorMatch[3];
    return result;
  }

  const setOnlyMatch = rest.match(/^(.+?)\s*\(([A-Z0-9]+)\)\s*$/i);
  if (setOnlyMatch) {
    result.cardName = setOnlyMatch[1].trim();
    result.setCode = setOnlyMatch[2].toUpperCase();
    return result;
  }

  return result;
}

function getDuplicateCardQuery(cardInfo, req) {
  const query = {
    name: cardInfo.name,
    condition: cardInfo.condition || 'NM',
    isFoil: Boolean(cardInfo.isFoil)
  };

  if (cardInfo.setCode && cardInfo.collectorNumber) {
    query.setCode = cardInfo.setCode;
    query.collectorNumber = cardInfo.collectorNumber;
  } else {
    query.set = cardInfo.set || 'Unknown';
  }

  return buildUserQuery(query, req);
}

function validateCardPayload(body, options = {}) {
  const { allowPartial = false } = options;
  const errors = [];
  if (!body || typeof body !== 'object') {
    errors.push('Request body must be an object');
    return errors;
  }

  if (allowPartial) {
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
      errors.push('Card name must be a non-empty string');
    }
  } else if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    errors.push('Card name is required');
  }

  if (body.condition !== undefined && !VALID_CONDITIONS.includes(body.condition)) {
    errors.push(`Condition must be one of: ${VALID_CONDITIONS.join(', ')}`);
  }

  if (body.quantity !== undefined && (!Number.isInteger(body.quantity) || body.quantity < 1)) {
    errors.push('Quantity must be a positive integer');
  }

  if (body.price !== undefined && body.price !== '' && Number.isNaN(Number(body.price))) {
    errors.push('Price must be a number');
  }

  if (body.buylistValue !== undefined && body.buylistValue !== '' && Number.isNaN(Number(body.buylistValue))) {
    errors.push('Buylist value must be a number');
  }

  if (body.sellValue !== undefined && body.sellValue !== '' && Number.isNaN(Number(body.sellValue))) {
    errors.push('Sell value must be a number');
  }

  if (body.isFoil !== undefined && typeof body.isFoil !== 'boolean') {
    errors.push('isFoil must be a boolean');
  }

  if (body.isToken !== undefined && typeof body.isToken !== 'boolean') {
    errors.push('isToken must be a boolean');
  }

  if (body.tags !== undefined && !Array.isArray(body.tags)) {
    errors.push('Tags must be an array of strings');
  }

  if (body.colors !== undefined && !Array.isArray(body.colors)) {
    errors.push('Colors must be an array of strings');
  }

  if (body.types !== undefined && !Array.isArray(body.types)) {
    errors.push('Types must be an array of strings');
  }

  if (body.priceAlert !== undefined) {
    if (typeof body.priceAlert !== 'object' || Array.isArray(body.priceAlert)) {
      errors.push('priceAlert must be an object');
    } else {
      const { targetPrice, targetHigh, emailNotification } = body.priceAlert;
      if (targetPrice !== undefined && targetPrice !== '' && Number.isNaN(Number(targetPrice))) {
        errors.push('priceAlert.targetPrice must be a number');
      }
      if (targetHigh !== undefined && targetHigh !== '' && Number.isNaN(Number(targetHigh))) {
        errors.push('priceAlert.targetHigh must be a number');
      }
      if (emailNotification !== undefined && typeof emailNotification !== 'boolean') {
        errors.push('priceAlert.emailNotification must be a boolean');
      }
    }
  }

  return errors;
}

function validateBulkUpdatePayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    errors.push('Request body must be an object');
    return errors;
  }

  if (!Array.isArray(body.cardIds) || body.cardIds.length === 0) {
    errors.push('cardIds array is required');
  }

  if (!body.updates || typeof body.updates !== 'object' || Array.isArray(body.updates)) {
    errors.push('updates object is required');
  }

  return errors;
}

function buildCardListQuery(req) {
  const query = buildUserQuery({}, req);
  const {
    search,
    set,
    color,
    type,
    condition,
    location,
    tag,
    rarity,
    isFoil,
    isToken,
    hasImage,
    sortBy,
    sortOrder,
    page,
    limit
  } = req.query;

  if (search && typeof search === 'string' && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [
      { name: regex },
      { set: regex },
      { oracleText: regex },
      { tags: regex }
    ];
  }

  if (set) query.set = set;
  if (condition) query.condition = condition;
  if (rarity) query.rarity = rarity;
  if (location) query.location = location;
  if (tag) query.tags = normalizeTag(tag);
  if (color) query.colors = color;
  if (type) query.types = type;
  if (hasImage === 'true') query.imageUrl = { $exists: true, $ne: null };
  if (isFoil === 'true' || isFoil === 'false') query.isFoil = isFoil === 'true';
  if (isToken === 'true' || isToken === 'false') query.isToken = isToken === 'true';

  const sort = {};
  const allowedSortFields = ['name', 'price', 'quantity', 'updatedAt', 'set', 'rarity', 'condition'];
  const selectedSort = allowedSortFields.includes(sortBy) ? sortBy : 'name';
  const selectedOrder = sortOrder === 'desc' ? -1 : 1;
  sort[selectedSort] = selectedOrder;

  const pageNumber = Math.max(1, parseInt(page, 10) || 1);
  const itemsPerPage = Math.min(Math.max(1, parseInt(limit, 10) || 1000), 1000);
  const usePagination = req.query.page !== undefined || req.query.limit !== undefined;

  return {
    query,
    sort,
    pagination: {
      page: pageNumber,
      limit: itemsPerPage,
      skip: (pageNumber - 1) * itemsPerPage,
      enabled: usePagination
    }
  };
}

// Groups a user's cards into exact-duplicate groups (identical
// name+set+condition+isFoil+collectorNumber) and Unknown-set merge
// suggestions (same name+condition+isFoil, one row from an offline import).
function findDuplicateGroups(cards) {
  const exactKey = c =>
    [c.name, c.set, c.condition, String(Boolean(c.isFoil)), c.collectorNumber || ''].join('||');

  const byExactKey = new Map();
  for (const card of cards) {
    const key = exactKey(card);
    if (!byExactKey.has(key)) byExactKey.set(key, []);
    byExactKey.get(key).push(card);
  }

  const exactGroups = [];
  const inExactGroup = new Set();
  for (const group of byExactKey.values()) {
    if (group.length > 1) {
      exactGroups.push({ cards: group });
      for (const card of group) inExactGroup.add(card._id.toString());
    }
  }

  const suggestedGroups = [];
  for (const card of cards) {
    if (card.set !== 'Unknown') continue;
    if (inExactGroup.has(card._id.toString())) continue;
    const candidates = cards.filter(other =>
      other.set !== 'Unknown' &&
      other.name === card.name &&
      other.condition === card.condition &&
      Boolean(other.isFoil) === Boolean(card.isFoil)
    );
    if (candidates.length > 0) {
      suggestedGroups.push({ unknownCard: card, candidates });
    }
  }

  return { exactGroups, suggestedGroups };
}

module.exports = {
  VALID_CONDITIONS,
  VALID_PRIORITIES,
  parseCardLine,
  getDuplicateCardQuery,
  validateCardPayload,
  validateBulkUpdatePayload,
  buildCardListQuery,
  normalizeTag,
  findDuplicateGroups
};
