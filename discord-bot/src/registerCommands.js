// discord-bot/src/registerCommands.js
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('link').setDescription('Link your MTG Tracker account')
    .addStringOption(o => o.setName('code').setDescription('The code shown in MTG Tracker Settings').setRequired(true)),

  new SlashCommandBuilder().setName('unlink').setDescription('Unlink your MTG Tracker account'),

  new SlashCommandBuilder().setName('card').setDescription('Look up a card (no linking required)')
    .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true)),

  new SlashCommandBuilder().setName('collection').setDescription('Collection commands')
    .addSubcommand(sub => sub.setName('stats').setDescription('Show your collection stats')),

  new SlashCommandBuilder().setName('add').setDescription('Add a card to your collection')
    .addIntegerOption(o => o.setName('quantity').setDescription('Quantity').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true)),

  new SlashCommandBuilder().setName('remove').setDescription('Remove a card from your collection')
    .addIntegerOption(o => o.setName('quantity').setDescription('Quantity').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true)),

  new SlashCommandBuilder().setName('update').setDescription('Update a card in your collection')
    .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true))
    .addStringOption(o => o.setName('field').setDescription('Field to update').setRequired(true)
      .addChoices(
        { name: 'condition', value: 'condition' },
        { name: 'quantity', value: 'quantity' },
        { name: 'location', value: 'location' }
      ))
    .addStringOption(o => o.setName('value').setDescription('New value').setRequired(true)),

  new SlashCommandBuilder().setName('price').setDescription("Refresh a card's price")
    .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true)),

  new SlashCommandBuilder().setName('wishlist').setDescription('Wishlist commands')
    .addSubcommand(sub => sub.setName('list').setDescription('Show your wishlist'))
    .addSubcommand(sub => sub.setName('add').setDescription('Add a card to your wishlist')
      .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove a card from your wishlist')
      .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true))),

  new SlashCommandBuilder().setName('decks').setDescription('List your decks'),

  new SlashCommandBuilder().setName('deck').setDescription('View a deck')
    .addStringOption(o => o.setName('name').setDescription('Deck name').setRequired(true)),

  new SlashCommandBuilder().setName('similar').setDescription('Find cards similar to one you own')
    .addStringOption(o => o.setName('card').setDescription('Card name').setRequired(true)),

  new SlashCommandBuilder().setName('synergy').setDescription('Find cards that synergize with one you own')
    .addStringOption(o => o.setName('card').setDescription('Card name').setRequired(true)),

  new SlashCommandBuilder().setName('commander').setDescription('Get commander recommendations based on your collection')
    .addStringOption(o => o.setName('colors').setDescription('Restrict to a color identity, e.g. UB or WUBRG')),

  new SlashCommandBuilder().setName('sets').setDescription('Show your set completion progress'),

  new SlashCommandBuilder().setName('location').setDescription('List cards stored at a location')
    .addStringOption(o => o.setName('name').setDescription('Location name').setRequired(true)),

  new SlashCommandBuilder().setName('deckstats').setDescription("Show a deck's power level and salt score")
    .addStringOption(o => o.setName('name').setDescription('Deck name').setRequired(true)),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log(`Registered ${commands.length} slash commands to guild ${process.env.DISCORD_GUILD_ID}.`);
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
})();
