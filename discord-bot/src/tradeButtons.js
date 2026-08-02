const { client } = require('./apiClient');
const { NOT_LINKED_MESSAGE } = require('./lib/notLinked');

const ACTIONS = {
  accept: { verb: 'accept', pastTense: 'Accepted' },
  reject: { verb: 'reject', pastTense: 'Rejected' },
  cancel: { verb: 'cancel', pastTense: 'Cancelled' }
};

async function handleTradeButton(interaction) {
  const [, action, offerId] = interaction.customId.match(/^trade-(accept|reject|cancel):(.+)$/) || [];
  if (!action || !offerId) return;

  const api = client(interaction.user.id);
  const res = await api.put(`/trades/offers/${offerId}/${ACTIONS[action].verb}`);

  if (res.status === 401) {
    return interaction.update({ content: `❌ ${NOT_LINKED_MESSAGE}`, components: [] });
  }

  if (res.status !== 200) {
    const message = res.data?.message || `Something went wrong (${res.status}).`;
    return interaction.update({ content: `❌ ${message}`, components: [] });
  }

  return interaction.update({ content: `✅ ${ACTIONS[action].pastTense} the offer.`, components: [] });
}

module.exports = { handleTradeButton };
