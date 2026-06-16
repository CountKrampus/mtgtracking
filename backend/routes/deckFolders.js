const express = require('express');
const router = express.Router();
const DeckFolder = require('../models/DeckFolder');
const Deck = require('../models/Deck');
const { requireAuth } = require('../middleware/auth');
const { getUserId } = require('../middleware/multiUser');

// Helper: collect all descendant folder IDs for a given folder (BFS)
async function getDescendantIds(userId, folderId) {
  const allFolders = await DeckFolder.find({ userId }).lean();
  const result = [];
  const queue = [String(folderId)];
  while (queue.length) {
    const current = queue.shift();
    const children = allFolders.filter(f => String(f.parentId) === current);
    children.forEach(c => {
      result.push(c._id);
      queue.push(String(c._id));
    });
  }
  return result;
}

// GET /api/deck-folders — flat list of all folders for the current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const folders = await DeckFolder.find({ userId }).sort({ name: 1 }).lean();
    res.json(folders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/deck-folders — create a folder
// Body: { name: string, parentId?: ObjectId|null }
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name, parentId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name is required' });

    // Validate parentId belongs to this user (if provided)
    if (parentId) {
      const parent = await DeckFolder.findOne({ _id: parentId, userId });
      if (!parent) return res.status(404).json({ message: 'Parent folder not found' });
    }

    const folder = new DeckFolder({
      userId,
      name: name.trim(),
      parentId: parentId || null
    });
    await folder.save();
    res.status(201).json(folder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/deck-folders/:id — rename a folder
// Body: { name: string }
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'name is required' });

    const folder = await DeckFolder.findOne({ _id: req.params.id, userId });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    folder.name = name.trim();
    await folder.save();
    res.json(folder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/deck-folders/:id — delete folder and all descendants
// Decks in deleted folders are moved to root (folderId = null)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const folder = await DeckFolder.findOne({ _id: req.params.id, userId });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    const descendantIds = await getDescendantIds(userId, req.params.id);
    const allIds = [folder._id, ...descendantIds];

    // Move affected decks to root
    await Deck.updateMany({ userId, folderId: { $in: allIds } }, { $set: { folderId: null } });

    // Delete all folders in the subtree
    await DeckFolder.deleteMany({ _id: { $in: allIds } });

    res.json({ message: 'Folder deleted', deleted: allIds.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
