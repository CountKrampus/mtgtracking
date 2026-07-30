const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Webhook = require('../models/Webhook');
const { verifyToken, requireAuth } = require('../middleware/auth');
const { isValidWebhookUrl, deliverToWebhook } = require('../utils/webhookDelivery');

const MAX_WEBHOOKS_PER_USER = 10;

router.use(verifyToken);

// GET /api/webhooks — list the current user's webhooks
router.get('/', requireAuth, async (req, res) => {
  try {
    const webhooks = await Webhook.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(webhooks);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching webhooks', error: err.message });
  }
});

// POST /api/webhooks — register a new webhook
router.post('/', requireAuth, async (req, res) => {
  try {
    const { url, events } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'url is required' });
    }
    if (!isValidWebhookUrl(url)) {
      return res.status(400).json({ message: 'Invalid webhook URL — must be a public http(s) URL' });
    }

    const count = await Webhook.countDocuments({ userId: req.user._id });
    if (count >= MAX_WEBHOOKS_PER_USER) {
      return res.status(400).json({ message: `Maximum of ${MAX_WEBHOOKS_PER_USER} webhooks per user` });
    }

    const webhook = await Webhook.create({
      userId: req.user._id,
      url,
      secret: crypto.randomBytes(24).toString('hex'),
      events: Array.isArray(events) && events.length > 0 ? events : ['price_alert'],
    });
    res.status(201).json(webhook);
  } catch (err) {
    res.status(500).json({ message: 'Error creating webhook', error: err.message });
  }
});

// PUT /api/webhooks/:id — update url/events/isActive
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const webhook = await Webhook.findOne({ _id: req.params.id, userId: req.user._id });
    if (!webhook) return res.status(404).json({ message: 'Webhook not found' });

    if (req.body.url !== undefined) {
      if (!isValidWebhookUrl(req.body.url)) {
        return res.status(400).json({ message: 'Invalid webhook URL — must be a public http(s) URL' });
      }
      webhook.url = req.body.url;
    }
    if (req.body.events !== undefined) webhook.events = req.body.events;
    if (req.body.isActive !== undefined) {
      webhook.isActive = req.body.isActive;
      if (webhook.isActive) webhook.failureCount = 0;
    }

    await webhook.save();
    res.json(webhook);
  } catch (err) {
    res.status(500).json({ message: 'Error updating webhook', error: err.message });
  }
});

// DELETE /api/webhooks/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const webhook = await Webhook.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!webhook) return res.status(404).json({ message: 'Webhook not found' });
    res.json({ message: 'Webhook deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting webhook', error: err.message });
  }
});

// POST /api/webhooks/:id/test — send a test price_alert event immediately
router.post('/:id/test', requireAuth, async (req, res) => {
  try {
    const webhook = await Webhook.findOne({ _id: req.params.id, userId: req.user._id });
    if (!webhook) return res.status(404).json({ message: 'Webhook not found' });

    await deliverToWebhook(webhook, 'price_alert', {
      cardName: 'Test Card',
      direction: 'low',
      targetPrice: 1.00,
      actualPrice: 0.95,
      test: true,
    });

    res.json({ lastStatus: webhook.lastStatus, lastTriggeredAt: webhook.lastTriggeredAt });
  } catch (err) {
    res.status(500).json({ message: 'Error testing webhook', error: err.message });
  }
});

module.exports = router;
