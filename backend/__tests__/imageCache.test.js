const fs = require('fs');
const path = require('path');

jest.mock('axios');
const axios = require('axios');

describe('cacheCardImage', () => {
  const testCacheDir = path.join(__dirname, '__tmp_image_cache__');

  beforeEach(() => {
    jest.resetModules();
    process.env.IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS = testCacheDir;
  });

  afterEach(() => {
    delete process.env.IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS;
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
    jest.clearAllMocks();
  });

  test('returns null if scryfallId or imageUrl is missing', async () => {
    const { cacheCardImage } = require('../utils/imageCache');
    expect(await cacheCardImage(null, 'http://example.com/x.jpg')).toBeNull();
    expect(await cacheCardImage('abc', null)).toBeNull();
  });

  test('returns the local URL without downloading if already cached', async () => {
    const { cacheCardImage, CACHE_DIR } = require('../utils/imageCache');
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, 'abc123.jpg'), 'fake-image-data');

    const result = await cacheCardImage('abc123', 'http://example.com/abc123.jpg');
    expect(result).toBe('/api/images/abc123');
    expect(axios).not.toHaveBeenCalled();
  });
});
