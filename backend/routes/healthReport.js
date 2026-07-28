const express = require('express');
const router = express.Router();
const CollectionHealthReport = require('../models/CollectionHealthReport');
const { verifyToken, requireAuth } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireAuth);

// GET /api/health-report - fetch the current user's most recent collection health report
router.get('/', async (req, res) => {
  try {
    const report = await CollectionHealthReport.findOne({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    if (!report) {
      return res.status(404).json({ message: 'No collection health report yet' });
    }

    res.json(report);
  } catch (error) {
    console.error('Get health report error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
