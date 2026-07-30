// discord-bot/src/lib/notLinked.js
const NOT_LINKED_MESSAGE =
  "You haven't linked your account yet — run `/link <code>` first. " +
  "Get a code from Settings in the MTG Tracker web app.";

function replyNotLinked(interaction) {
  return interaction.reply({ content: NOT_LINKED_MESSAGE, ephemeral: true });
}

module.exports = { NOT_LINKED_MESSAGE, replyNotLinked };
