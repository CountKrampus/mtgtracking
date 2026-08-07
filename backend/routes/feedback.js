const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { verifyToken, requireAuth } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireAuth);

const VALID_CATEGORIES = ['bug', 'feature', 'other'];

router.post('/', async (req, res) => {
  try {
    const { message, category, pageUrl, userAgent } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Feedback message is required' });
    }

    const feedback = await Feedback.create({
      submitter: req.user._id,
      message: message.trim(),
      category: VALID_CATEGORIES.includes(category) ? category : 'other',
      pageUrl: pageUrl || '',
      userAgent: userAgent || '',
    });

    res.status(201).json({ feedback });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
