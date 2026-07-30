const axios = require('axios');
const crypto = require('crypto');
const Webhook = require('../models/Webhook');

const MAX_FAILURES_BEFORE_DISABLE = 10;

// Basic SSRF guard: registering a webhook URL lets this server make outbound
// requests on the user's behalf, so block obviously-internal targets. This is
// a hostname-pattern check, not full DNS-rebinding protection — proportional
// to a personal collection tracker's threat model, not a public multi-tenant API.
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
];

function isValidWebhookUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (BLOCKED_HOSTNAME_PATTERNS.some(re => re.test(parsed.hostname))) return false;
  return true;
}

function signPayload(secret, payload) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

/**
 * Delivers an event to a single webhook document, recording the outcome on
 * it (and auto-disabling after repeated failures) rather than throwing.
 */
async function deliverToWebhook(webhook, eventType, data) {
  const payload = { event: eventType, data, sentAt: new Date().toISOString() };
  try {
    const response = await axios.post(webhook.url, payload, {
      headers: { 'X-Webhook-Signature': signPayload(webhook.secret, payload) },
      timeout: 5000,
    });
    webhook.lastTriggeredAt = new Date();
    webhook.lastStatus = response.status;
    webhook.failureCount = 0;
    await webhook.save();
  } catch (err) {
    webhook.lastTriggeredAt = new Date();
    webhook.lastStatus = err.response?.status || 0;
    webhook.failureCount = (webhook.failureCount || 0) + 1;
    if (webhook.failureCount >= MAX_FAILURES_BEFORE_DISABLE) {
      webhook.isActive = false;
      console.warn(`[webhookDelivery] Disabling webhook ${webhook._id} after ${webhook.failureCount} consecutive failures`);
    }
    await webhook.save();
  }
}

/**
 * Delivers an event to all of a user's active webhooks subscribed to it.
 * Fire-and-forget from the caller's perspective — see deliverToWebhook.
 */
async function deliverWebhookEvent(userId, eventType, data) {
  let webhooks;
  try {
    webhooks = await Webhook.find({ userId, isActive: true, events: eventType });
  } catch (err) {
    console.error('[webhookDelivery] Failed to load webhooks:', err.message);
    return;
  }

  for (const webhook of webhooks) {
    await deliverToWebhook(webhook, eventType, data);
  }
}

module.exports = { deliverWebhookEvent, deliverToWebhook, isValidWebhookUrl, signPayload };
