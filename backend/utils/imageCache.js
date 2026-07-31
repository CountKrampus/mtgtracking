const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { pipeline } = require('stream/promises');

const CACHE_DIR = process.env.IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS || path.join(__dirname, '..', 'cached-images', 'mtg-cards');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log('Image cache directory created:', CACHE_DIR);
}

// Download and cache image from Scryfall, return local path or fallback to URL
async function cacheCardImage(scryfallId, imageUrl) {
  if (!scryfallId || !imageUrl) {
    return null;
  }

  const filename = `${scryfallId}.jpg`;
  const filepath = path.join(CACHE_DIR, filename);
  const localUrl = `/api/images/${scryfallId}`;

  // Check if already cached
  if (fs.existsSync(filepath)) {
    console.log(`Image cache hit: ${scryfallId}`);
    return localUrl;
  }

  // Download and cache image
  try {
    console.log(`Downloading image: ${scryfallId}`);
    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream'
    });

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

module.exports = { CACHE_DIR, cacheCardImage };
