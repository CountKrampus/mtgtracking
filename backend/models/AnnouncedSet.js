const mongoose = require('mongoose');

// Tracks which MTG sets the setReleaseAnnouncer job has already posted a
// forum thread for, so re-running the job (daily) never double-posts.
const announcedSetSchema = new mongoose.Schema({
  setCode: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  setName: {
    type: String,
    required: true
  },
  releasedAt: {
    type: Date,
    required: true
  },
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumThread',
    required: true
  },
  postedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AnnouncedSet', announcedSetSchema);
