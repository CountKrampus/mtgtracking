const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PAGE_SIZE = 25;
const COLORS = ['W', 'U', 'B', 'R', 'G'];

function filterCards(cards, { set, type, colors }) {
  return cards.filter(c => {
    if (set && c.set !== set) return false;
    if (type && !(c.types || []).includes(type)) return false;
    if (colors && colors.size > 0) {
      const cardColors = c.colors || [];
      const matchesColor = cardColors.some(col => colors.has(col));
      const matchesColorless = colors.has('C') && cardColors.length === 0;
      if (!matchesColor && !matchesColorless) return false;
    }
    return true;
  });
}

function paginate(filtered, page) {
  const start = page * PAGE_SIZE;
  return filtered.slice(start, start + PAGE_SIZE);
}

function buildSetOptions(cards, selectedSet) {
  const uniqueSets = [...new Set(cards.map(c => c.set).filter(Boolean))].sort();
  const options = [{ label: 'All Sets', value: '', default: !selectedSet }];
  for (const set of uniqueSets.slice(0, 24)) {
    options.push({ label: set.slice(0, 100), value: set, default: set === selectedSet });
  }
  return options;
}

function buildTypeOptions(cards, selectedType) {
  const uniqueTypes = [...new Set(cards.flatMap(c => c.types || []))].sort();
  const options = [{ label: 'All Types', value: '', default: !selectedType }];
  for (const type of uniqueTypes.slice(0, 24)) {
    options.push({ label: type.slice(0, 100), value: type, default: type === selectedType });
  }
  return options;
}

function buildCardOptions(pageCards) {
  if (pageCards.length === 0) {
    return [{ label: 'No matching cards', value: '__none__' }];
  }
  return pageCards.map(c => ({
    label: `${c.name} (${c.set || 'Unknown'}, ${c.condition})`.slice(0, 100),
    value: c._id
  }));
}

function buildBrowserRows(cards, state) {
  const filtered = filterCards(cards, state);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageCards = paginate(filtered, state.page);

  const toSelectOptions = options =>
    options.map(o => ({ ...o, value: o.value === '' ? '__all__' : o.value }));

  const setRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('browse-set-select')
      .setPlaceholder(state.set || 'All Sets')
      .addOptions(toSelectOptions(buildSetOptions(cards, state.set)))
  );

  const typeRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('browse-type-select')
      .setPlaceholder(state.type || 'All Types')
      .addOptions(toSelectOptions(buildTypeOptions(cards, state.type)))
  );

  const colorRow = new ActionRowBuilder().addComponents(
    ...COLORS.map(color =>
      new ButtonBuilder()
        .setCustomId(`browse-color:${color}`)
        .setLabel(color)
        .setStyle(state.colors.has(color) ? ButtonStyle.Success : ButtonStyle.Secondary)
    )
  );

  const controlsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('browse-color:C')
      .setLabel('Colorless')
      .setStyle(state.colors.has('C') ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('browse-color-reset')
      .setLabel('All Colors')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('browse-prev')
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.page === 0),
    new ButtonBuilder()
      .setCustomId('browse-next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.page >= totalPages - 1)
  );

  const cardRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('browse-card-select')
      .setPlaceholder(pageCards.length === 0 ? 'No matching cards' : 'Select a card to list')
      .setDisabled(pageCards.length === 0)
      .addOptions(buildCardOptions(pageCards))
  );

  return { rows: [setRow, typeRow, colorRow, controlsRow, cardRow], filtered, pageCards, totalPages };
}

module.exports = {
  PAGE_SIZE,
  COLORS,
  filterCards,
  paginate,
  buildSetOptions,
  buildTypeOptions,
  buildCardOptions,
  buildBrowserRows
};
