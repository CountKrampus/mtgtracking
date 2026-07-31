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

  test('caches a new image into its sharded subdirectory, not the flat directory', async () => {
    const { cacheCardImage, CACHE_DIR } = require('../utils/imageCache');
    // Re-require axios: after jest.resetModules() in beforeEach, the
    // top-level `axios` reference is a stale automock instance distinct
    // from the one imageCache.js just picked up internally.
    const axios = require('axios');
    const { Readable } = require('stream');
    axios.mockResolvedValue({ data: Readable.from([Buffer.from('fake-image-bytes')]) });

    const result = await cacheCardImage('newcard123', 'http://example.com/newcard123.jpg');

    expect(result).toBe('/api/images/newcard123');
    expect(fs.existsSync(path.join(CACHE_DIR, 'ne', 'newcard123.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(CACHE_DIR, 'newcard123.jpg'))).toBe(false);
  });

  test('resolveCachedFilepath finds a sharded file', async () => {
    const { cacheCardImage, resolveCachedFilepath, CACHE_DIR } = require('../utils/imageCache');
    const axios = require('axios');
    const { Readable } = require('stream');
    axios.mockResolvedValue({ data: Readable.from([Buffer.from('fake-image-bytes')]) });
    await cacheCardImage('shardedcard1', 'http://example.com/shardedcard1.jpg');

    expect(resolveCachedFilepath('shardedcard1')).toBe(path.join(CACHE_DIR, 'sh', 'shardedcard1.jpg'));
  });

  test('resolveCachedFilepath falls back to the old flat location for pre-migration files', () => {
    const { resolveCachedFilepath, CACHE_DIR } = require('../utils/imageCache');
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, 'oldflat1.jpg'), 'fake-image-data');

    expect(resolveCachedFilepath('oldflat1')).toBe(path.join(CACHE_DIR, 'oldflat1.jpg'));
  });

  test('resolveCachedFilepath returns null when nothing is cached', () => {
    const { resolveCachedFilepath } = require('../utils/imageCache');
    expect(resolveCachedFilepath('nonexistent')).toBeNull();
  });
});
