const { StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');

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

  const options = matches.slice(0, 25).map(c => ({
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

  try {
    const selectInteraction = await interaction.channel.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: i => i.customId === 'resolve-card-select' && i.user.id === interaction.user.id,
      time: 30000
    });
    const chosen = matches.find(c => c._id === selectInteraction.values[0]);
    await selectInteraction.update({ content: `Selected: ${chosen.name}`, components: [] });
    return { status: 'found', card: chosen };
  } catch {
    return { status: 'timed_out' };
  }
}

module.exports = { resolveCard };
