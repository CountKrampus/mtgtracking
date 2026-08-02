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
      .addStringOption(o => o.setName('name').setDescription('Card name').setRequired(true)))
    .addSubcommand(sub => sub.setName('deals').setDescription('Show wishlist items at or below your target price')),

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

  new SlashCommandBuilder().setName('achievements').setDescription('Show your earned collector achievements'),

  new SlashCommandBuilder().setName('pricealerts').setDescription('List your cards with an active price alert'),

  new SlashCommandBuilder().setName('trades').setDescription('Trading commands')
    .addSubcommand(sub => sub.setName('browse').setDescription('Browse active trade listings')
      .addStringOption(o => o.setName('type').setDescription('Filter by listing type')
        .addChoices({ name: 'have', value: 'have' }, { name: 'want', value: 'want' }))
      .addStringOption(o => o.setName('card').setDescription('Filter by card name')))
    .addSubcommand(sub => sub.setName('my-listings').setDescription('Show your own active listings'))
    .addSubcommand(sub => sub.setName('create').setDescription('List a card you have or want to trade')
      .addStringOption(o => o.setName('type').setDescription('Listing type').setRequired(true)
        .addChoices({ name: 'have', value: 'have' }, { name: 'want', value: 'want' }))
      .addStringOption(o => o.setName('card').setDescription('Card name (required for "want"; leave blank with "have" to browse your collection)'))
      .addStringOption(o => o.setName('message').setDescription('Optional note')))
    .addSubcommand(sub => sub.setName('offer').setDescription('Offer one or more of your cards on a listing')
      .addStringOption(o => o.setName('listing').setDescription('Card name of the listing to offer on').setRequired(true))
      .addStringOption(o => o.setName('message').setDescription('Optional note')))
    .addSubcommand(sub => sub.setName('received').setDescription('Review pending trade offers you\'ve received'))
    .addSubcommand(sub => sub.setName('sent').setDescription('View trade offers you\'ve sent')),
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
