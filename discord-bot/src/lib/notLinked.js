// discord-bot/src/lib/notLinked.js
const NOT_LINKED_MESSAGE =
  "You haven't linked your account yet — run `/link <code>` first. " +
  "Get a code from Settings in the MTG Tracker web app.";

// Some commands defer their reply before this is called (e.g. those using
// resolveCard, which may take multiple round-trips) - discord.js requires
// editReply instead of reply once an interaction is already deferred/replied.
function replyNotLinked(interaction) {
  const payload = { content: NOT_LINKED_MESSAGE, ephemeral: true };
  return (interaction.deferred || interaction.replied)
    ? interaction.editReply(payload)
    : interaction.reply(payload);
}

module.exports = { NOT_LINKED_MESSAGE, replyNotLinked };
