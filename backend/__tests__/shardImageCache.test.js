const fs = require('fs');
const path = require('path');

describe('shardImageCache migration script', () => {
  const testCacheDir = path.join(__dirname, '__tmp_shard_migration_cache__');

  beforeEach(() => {
    jest.resetModules();
    process.env.IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS = testCacheDir;
  });

  afterEach(() => {
    delete process.env.IMAGE_CACHE_DIR_OVERRIDE_FOR_TESTS;
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  test('moves flat files into their sharded subdirectories', () => {
    fs.mkdirSync(testCacheDir, { recursive: true });
    fs.writeFileSync(path.join(testCacheDir, 'abc123.jpg'), 'fake-a');
    fs.writeFileSync(path.join(testCacheDir, 'def456.jpg'), 'fake-b');

    const { migrate } = require('../scripts/shardImageCache');
    const result = migrate();

    expect(result.moved).toBe(2);
    expect(fs.existsSync(path.join(testCacheDir, 'ab', 'abc123.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(testCacheDir, 'de', 'def456.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(testCacheDir, 'abc123.jpg'))).toBe(false);
  });

  test('is idempotent - a second run finds nothing left to move', () => {
    fs.mkdirSync(testCacheDir, { recursive: true });
    fs.writeFileSync(path.join(testCacheDir, 'abc123.jpg'), 'fake-a');

    const { migrate } = require('../scripts/shardImageCache');
    migrate();
    const secondResult = migrate();

    expect(secondResult.moved).toBe(0);
  });

  test('does not recurse into already-sharded subdirectories looking for more work', () => {
    fs.mkdirSync(path.join(testCacheDir, 'ab'), { recursive: true });
    fs.writeFileSync(path.join(testCacheDir, 'ab', 'abc999.jpg'), 'already-sharded');

    const { migrate } = require('../scripts/shardImageCache');
    const result = migrate();

    expect(result.moved).toBe(0);
    expect(fs.existsSync(path.join(testCacheDir, 'ab', 'abc999.jpg'))).toBe(true);
  });
});
