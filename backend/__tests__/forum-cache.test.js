const cache = require('../cache/forumCache');

afterEach(() => {
  cache.del('test-key');
  cache.delPattern('prefix:');
});

describe('forumCache', () => {
  test('returns undefined for missing key', () => {
    expect(cache.get('test-key')).toBeUndefined();
  });

  test('returns value after set', () => {
    cache.set('test-key', { foo: 'bar' }, 60);
    expect(cache.get('test-key')).toEqual({ foo: 'bar' });
  });

  test('del removes a key', () => {
    cache.set('test-key', 'hello', 60);
    cache.del('test-key');
    expect(cache.get('test-key')).toBeUndefined();
  });

  test('delPattern removes all keys with matching prefix', () => {
    cache.set('prefix:a', 1, 60);
    cache.set('prefix:b', 2, 60);
    cache.set('other:c', 3, 60);
    cache.delPattern('prefix:');
    expect(cache.get('prefix:a')).toBeUndefined();
    expect(cache.get('prefix:b')).toBeUndefined();
    expect(cache.get('other:c')).toBe(3);
    cache.del('other:c');
  });
});
