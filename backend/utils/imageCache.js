const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { pipeline } = require('stream/promises');

const CACHE_DIR = process.env.IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS || path.join(__dirname, '..', 'cached-images', 'mtg-cards');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log('Image cache directory created:', CACHE_DIR);
}

// Sharded image cache: files live under CACHE_DIR/<first 2 chars of scryfallId>/<scryfallId>.jpg
// rather than directly in CACHE_DIR, to keep the directory from becoming one
// enormous flat folder as more sets release. See backend/scripts/shardImageCache.js
// for the one-time migration of pre-existing flat-layout files.
function shardedPath(scryfallId) {
  return path.join(CACHE_DIR, scryfallId.slice(0, 2), `${scryfallId}.jpg`);
}

function flatPath(scryfallId) {
  return path.join(CACHE_DIR, `${scryfallId}.jpg`);
}

// Resolve an existing cached file's path, checking the sharded location first
// and falling back to the old flat location (for files not yet migrated).
// Returns null if the image isn't cached anywhere.
function resolveCachedFilepath(scryfallId) {
  const sharded = shardedPath(scryfallId);
  if (fs.existsSync(sharded)) return sharded;
  const flat = flatPath(scryfallId);
  if (fs.existsSync(flat)) return flat;
  return null;
}

// Download and cache image from Scryfall, return local path or fallback to URL
async function cacheCardImage(scryfallId, imageUrl) {
  if (!scryfallId || !imageUrl) {
    return null;
  }

  const localUrl = `/api/images/${scryfallId}`;

  // Check if already cached (sharded location first, then the old flat location)
  if (resolveCachedFilepath(scryfallId)) {
    console.log(`Image cache hit: ${scryfallId}`);
    return localUrl;
  }

  // Download and cache image into its sharded location
  const filepath = shardedPath(scryfallId);
  try {
    console.log(`Downloading image: ${scryfallId}`);
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream'
    });

    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    const writer = fs.createWriteStream(filepath);
    await pipeline(response.data, writer);

    console.log(`Image cached successfully: ${scryfallId}`);
    return localUrl;
  } catch (error) {
    console.error(`Failed to cache image for ${scryfallId}:`, error.message);
    // Fallback to original Scryfall URL if caching fails
    return imageUrl;
  }
}

module.exports = { CACHE_DIR, cacheCardImage, resolveCachedFilepath };
