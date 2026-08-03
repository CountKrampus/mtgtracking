// discord-bot/src/index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { client: apiClient, resolveImageUrl } = require('./apiClient');
const { handleTradeButton } = require('./tradeButtons');

const commands = new Map([
  require('./commands/link'),
  require('./commands/unlink'),
  require('./commands/card'),
  require('./commands/collection'),
  require('./commands/add'),
  require('./commands/remove'),
  require('./commands/update'),
  require('./commands/price'),
  require('./commands/wishlist'),
  require('./commands/decks'),
  require('./commands/deck'),
  require('./commands/similar'),
  require('./commands/synergy'),
  require('./commands/commander'),
  require('./commands/sets'),
  require('./commands/location'),
  require('./commands/deckstats'),
  require('./commands/achievements'),
  require('./commands/pricealerts'),
  require('./commands/trades'),
].map(cmd => [cmd.name, cmd]));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, readyClient => {
  console.log(`Discord bot logged in as ${readyClient.user.tag}`);
  startNotificationPoller();
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton() && interaction.customId.startsWith('trade-')) {
    try {
      await handleTradeButton(interaction);
    } catch (error) {
      console.error(`Error handling button ${interaction.customId}:`, error);
      await safeErrorReply(interaction);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);
    await safeErrorReply(interaction);
  }
});

// The interaction itself may already be expired/unknown by the time we try to
// report the original error (e.g. a command took too long and Discord's 3s
// window closed), in which case reply/followUp throws too. That secondary
// failure must not escape uncaught - discord.js emits it as an unhandled
// 'error' event on the Client, which crashes the whole process.
async function safeErrorReply(interaction) {
  const payload = { content: '❌ Something went wrong running that command.', ephemeral: true };
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (replyError) {
    console.error('Failed to send error reply (interaction likely expired):', replyError.message);
  }
}

// Polls for undelivered price-alert notifications across all linked users
// and DMs each one. Delivery state lives on the backend (Notification.discordDeliveredAt),
// marked only after a DM actually succeeds - so a bot restart, or one DM
// failing while others in the same batch succeed, can't cause an alert to
// be silently lost. It just stays undelivered and gets retried next poll.
//
// Uses a recursive setTimeout rather than setInterval, since setInterval
// would fire the next poll on schedule even if the previous one is still
// in flight (e.g. slow backend, many DMs).
async function startNotificationPoller() {
  const poll = async () => {
    try {
      const api = apiClient();
      const res = await api.get('/discord/notifications/pending');
      if (res.status === 200) {
        const deliveredIds = [];
        for (const notif of res.data.notifications) {
          try {
            const user = await client.users.fetch(notif.discordUserId);
            await user.send({ content: `📉 Price Alert: ${notif.content}` });
            deliveredIds.push(notif.id);
          } catch (dmError) {
            console.error(`Failed to DM ${notif.discordUserId}:`, dmError.message);
          }
        }

        if (deliveredIds.length > 0) {
          await api.post('/discord/notifications/mark-delivered', { ids: deliveredIds });
        }
      }
    } catch (error) {
      console.error('Notification poll failed:', error.message);
    } finally {
      setTimeout(poll, 30000);
    }
  };

  setTimeout(poll, 30000);
}

client.login(process.env.DISCORD_BOT_TOKEN);
