function extractDeckFromText(text) {
  const lines = text.split('\n');
  const cards = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comment lines
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;

    // Skip obvious section headers (e.g., "Lands", "Creatures", "//Sideboard")
    if (/^[A-Za-z\s]+:$/.test(trimmed)) continue;

    // Try "4 Lightning Bolt" or "4x Lightning Bolt"
    let match = trimmed.match(/^(\d+)x?\s+(.+)$/);
    if (match) {
      const qty = parseInt(match[1]);
      const name = match[2].trim()
        // Strip trailing set codes like "(M21)" or "(PLST) C18-245"
        .replace(/\s*\([A-Z0-9]+\)\s*[A-Z0-9\-]*$/i, '')
        .trim();
      if (name) cards.push({ name, quantity: qty });
      continue;
    }

    // Try "Lightning Bolt x4" or "Lightning Bolt 4x"
    match = trimmed.match(/^(.+?)\s+x?(\d+)$/i);
    if (match) {
      const name = match[1].trim()
        .replace(/\s*\([A-Z0-9]+\)\s*[A-Z0-9\-]*$/i, '')
        .trim();
      const qty = parseInt(match[2]);
      if (name) cards.push({ name, quantity: qty });
      continue;
    }

    // Try numbered list: "1. Lightning Bolt 4x"
    match = trimmed.match(/^\d+\.\s+(.+)$/);
    if (match) {
      const rest = match[1].trim();
      // Check if rest has a quantity at the end
      const qtyMatch = rest.match(/^(.+?)\s+x?(\d+)$/i);
      if (qtyMatch) {
        const name = qtyMatch[1].trim().replace(/\s*\([A-Z0-9]+\)\s*[A-Z0-9\-]*$/i, '').trim();
        if (name) cards.push({ name, quantity: parseInt(qtyMatch[2]) });
      } else {
        const name = rest.replace(/\s*\([A-Z0-9]+\)\s*[A-Z0-9\-]*$/i, '').trim();
        if (name) cards.push({ name, quantity: 1 });
      }
      continue;
    }

    // Plain card name (no quantity) - only if it looks like a card name (not too short, not all-caps heading)
    if (trimmed.length > 2 && !/^\d+$/.test(trimmed) && trimmed !== trimmed.toUpperCase()) {
      const name = trimmed.replace(/\s*\([A-Z0-9]+\)\s*[A-Z0-9\-]*$/i, '').trim();
      if (name) cards.push({ name, quantity: 1 });
    }
  }

  return {
    cards,
    total: cards.reduce((sum, c) => sum + c.quantity, 0)
  };
}

module.exports = { extractDeckFromText };
