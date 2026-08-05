// Quick script to print user count and first 10 users (safe read-only)
const mongoose = require('mongoose');

(async function() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mtg-tracker';
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    const db = mongoose.connection.db;
    const usersColl = db.collection('users');

    const count = await usersColl.countDocuments();
    const users = await usersColl.find({}, { projection: { passwordHash: 0 } }).sort({ createdAt: -1 }).limit(10).toArray();

    console.log(JSON.stringify({ count, users }, null, 2));

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error querying users:', err && err.message ? err.message : err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
})();
