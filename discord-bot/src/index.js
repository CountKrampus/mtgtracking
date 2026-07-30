// discord-bot/src/index.js
require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { client: apiClient, resolveImageUrl } = require('./apiClient');

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
].map(cmd => [cmd.name, cmd]));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, readyClient => {
  console.log(`Discord bot logged in as ${readyClient.user.tag}`);
  startNotificationPoller();
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);
    const payload = { content: '❌ Something went wrong running that command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  }
});

// Polls for price-alert notifications across all linked users and DMs each
// one. Keeps `since` in memory only - on a bot restart it resets to "now",
// so at most it silently skips alerts that fired during the downtime rather
// than replaying old ones.
let since = new Date();

async function startNotificationPoller() {
  setInterval(async () => {
    try {
      const api = apiClient();
      const res = await api.get('/discord/notifications/pending', { params: { since: since.toISOString() } });
      if (res.status !== 200) return;

      for (const notif of res.data.notifications) {
        try {
          const user = await client.users.fetch(notif.discordUserId);
          await user.send({ content: `📉 Price Alert: ${notif.content}` });
        } catch (dmError) {
          console.error(`Failed to DM ${notif.discordUserId}:`, dmError.message);
        }
      }

      if (res.data.notifications.length > 0) {
        since = new Date(res.data.notifications[res.data.notifications.length - 1].createdAt);
      }
    } catch (error) {
      console.error('Notification poll failed:', error.message);
    }
  }, 30000);
}

client.login(process.env.DISCORD_BOT_TOKEN);
