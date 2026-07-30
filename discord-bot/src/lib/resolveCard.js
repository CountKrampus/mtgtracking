const { StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');

// Discord's StringSelectMenu allows at most 25 options per menu.
const MAX_SELECT_OPTIONS = 25;

// Finds the calling user's owned card(s) matching `searchName` (case-
// insensitive substring against GET /api/cards, since that route has no
// server-side search param - filtering happens here, same as the web
// frontend's client-side filtering).
//
// Returns one of:
//   { status: 'not_linked' }
//   { status: 'error', httpStatus }
//   { status: 'no_match' }
//   { status: 'found', card }
//   { status: 'timed_out' }   (user didn't pick from the disambiguation menu)
async function resolveCard(interaction, api, searchName) {
  const res = await api.get('/cards');
  if (res.status === 401) return { status: 'not_linked' };
  if (res.status !== 200) return { status: 'error', httpStatus: res.status };

  const needle = searchName.trim().toLowerCase();
  const matches = res.data.filter(c => c.name.toLowerCase().includes(needle));

  if (matches.length === 0) return { status: 'no_match' };
  if (matches.length === 1) return { status: 'found', card: matches[0] };

  const options = matches.slice(0, MAX_SELECT_OPTIONS).map(c => ({
    label: `${c.name} (${c.set || 'Unknown'}, ${c.condition})`.slice(0, 100),
    value: c._id
  }));
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('resolve-card-select')
      .setPlaceholder('Multiple cards match — pick one')
      .addOptions(options)
  );

  await interaction.followUp({
    content: `Found ${matches.length} matches for "${searchName}":`,
    components: [row],
    ephemeral: true
  });

  let selectInteraction;
  try {
    selectInteraction = await interaction.channel.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: i => i.customId === 'resolve-card-select' && i.user.id === interaction.user.id,
      time: 30000
    });
  } catch {
    // awaitMessageComponent only rejects when the 30s window elapses with no
    // selection - a real timeout, not a Discord API error.
    return { status: 'timed_out' };
  }

  const chosen = matches.find(c => c._id === selectInteraction.values[0]);
  // A selection was made - this is a 'found' result regardless of whether the
  // follow-up UI update below succeeds, so it's outside the timeout try/catch
  // and any failure here isn't mislabeled as a timeout.
  await selectInteraction.update({ content: `Selected: ${chosen.name}`, components: [] });
  return { status: 'found', card: chosen };
}

module.exports = { resolveCard };
