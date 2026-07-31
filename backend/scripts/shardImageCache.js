// One-time migration: moves existing flat-layout cached images
// (backend/cached-images/mtg-cards/<scryfallId>.jpg) into their sharded
// subdirectories (backend/cached-images/mtg-cards/<first 2 chars>/<scryfallId>.jpg).
//
// Safe to run more than once - a second run finds no flat files left and does nothing.
//
// Usage: node backend/scripts/shardImageCache.js

const fs = require('fs');
const path = require('path');
const { CACHE_DIR } = require('../utils/imageCache');

function migrate() {
  const entries = fs.readdirSync(CACHE_DIR, { withFileTypes: true });
  const flatFiles = entries.filter(e => e.isFile() && e.name.endsWith('.jpg'));

  let moved = 0;
  let skipped = 0;

  for (const entry of flatFiles) {
    const shard = entry.name.slice(0, 2);
    const shardDir = path.join(CACHE_DIR, shard);
    const destPath = path.join(shardDir, entry.name);
    const srcPath = path.join(CACHE_DIR, entry.name);

    if (fs.existsSync(destPath)) {
      // Already present at destination (e.g. re-run after a partial migration) - remove the stale flat duplicate
      fs.unlinkSync(srcPath);
      skipped++;
      continue;
    }

    fs.mkdirSync(shardDir, { recursive: true });
    fs.renameSync(srcPath, destPath);
    moved++;
  }

  return { moved, skipped };
}

if (require.main === module) {
  const result = migrate();
  console.log(`Image cache migration complete: ${result.moved} files moved, ${result.skipped} already-migrated duplicates removed.`);
}

module.exports = { migrate };
