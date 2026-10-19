// discord-bot/src/lib/pager.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const DEFAULT_PAGE_SIZE = 10;
const PAGE_BUTTON_IDS = { prev: 'pager:prev', next: 'pager:next' };

function paginate(items, pageSize = DEFAULT_PAGE_SIZE) {
  if (pageSize < 1) throw new Error('pageSize must be >= 1');
  const pages = [];
  for (let i = 0; i < items.length; i += pageSize) {
    pages.push(items.slice(i, i + pageSize));
  }
  return pages;
}

function pageRow(page, pageCount) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PAGE_BUTTON_IDS.prev)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId(PAGE_BUTTON_IDS.next)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === pageCount - 1)
  );
}

/**
 * Posts a paginated embed for an already-deferred interaction.
 *
 * Two calling styles:
 *   - Static list:   pass `lines` (array of strings); `pageSize` slices it.
 *   - Server-paged:  pass `pageCount` plus an async `loadLines(pageIndex)`
 *     (e.g. /cards?page=N), so the bot never pulls a whole collection into
 *     memory just to paginate it.
 *
 * Contract details that callers/tests rely on:
 *   - The first page goes out via followUp (the repo-wide convention after
 *     deferReply); page changes then edit the same message through the button
 *     interaction's update().
 *   - A single-page result carries NO `components` key at all — not even an
 *     empty array — so consumers can tell "no pager" from "pager present".
 *   - After 60s without a click the buttons are stripped, so the message is
 *     never left with unresponsive controls.
 */
async function sendPaginated(interaction, {
  title,
  color,
  lines = null,
  pageCount = null,
  loadLines = null,
  pageSize = DEFAULT_PAGE_SIZE,
  footerExtra = null,
}) {
  let pages = null;
  if (lines) {
    pages = paginate(lines, pageSize);
    pageCount = pages.length;
    loadLines = (i) => pages[i];
  }
  if (!pageCount || !loadLines) {
    throw new Error('sendPaginated requires either lines, or pageCount + loadLines');
  }

  const render = async (page) => {
    const pageLines = await loadLines(page);
    const footerText = [`Page ${page + 1}/${pageCount}`, ...(footerExtra ? [footerExtra] : [])].join(' · ');
    const payload = {
      embeds: [{
        title,
        color,
        description: pageLines.join('\n'),
        footer: { text: footerText },
      }],
    };
    if (pageCount > 1) payload.components = [pageRow(page, pageCount)];
    return payload;
  };

  const firstPayload = await render(0);
  const message = await interaction.followUp(firstPayload);
  if (pageCount <= 1) return message;

  let page = 0;
  for (;;) {
    let button;
    try {
      button = await interaction.channel.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) =>
          i.user.id === interaction.user.id &&
          (i.customId === PAGE_BUTTON_IDS.prev || i.customId === PAGE_BUTTON_IDS.next),
        time: 60000,
      });
    } catch {
      // Timed out: remove the dead buttons. (message may be missing if the
      // caller's environment didn't return one from followUp — never let
      // cleanup break the command.)
      if (message && typeof message.edit === 'function') {
        await message.edit({ components: [] }).catch(() => {});
      }
      return message;
    }
    page = Math.min(Math.max(page + (button.customId === PAGE_BUTTON_IDS.next ? 1 : -1), 0), pageCount - 1);
    await button.update(await render(page));
  }
}

module.exports = { paginate, sendPaginated, DEFAULT_PAGE_SIZE, PAGE_BUTTON_IDS };