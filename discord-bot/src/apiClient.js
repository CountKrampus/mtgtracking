// discord-bot/src/apiClient.js
require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';
const SERVICE_TOKEN = process.env.DISCORD_BOT_SERVICE_TOKEN;

// Returns an axios instance authenticated as the bot, optionally acting on
// behalf of a specific Discord user. validateStatus always returns true so
// callers can branch on res.status (401 = not linked, etc.) without
// try/catch on every call.
function client(discordUserId) {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      Authorization: `Bearer ${SERVICE_TOKEN}`,
      ...(discordUserId ? { 'X-Discord-User-Id': discordUserId } : {})
    },
    validateStatus: () => true
  });
}

// Resolves a card's imageUrl (which may be an absolute Scryfall CDN URL, or
// a relative /api/images/:id path from the backend's local cache) into an
// absolute URL Discord's servers can actually fetch for an embed image.
function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
  const base = process.env.PUBLIC_ASSET_BASE_URL || API_BASE_URL.replace(/\/api\/?$/, '');
  return `${base}${imageUrl}`;
}

module.exports = { client, resolveImageUrl };
