const { getFromCache, setInCache, clearCache } = require('../utils/statsCache');

describe('statsCache', () => {
  test('returns null for a key with nothing cached', () => {
    expect(getFromCache('cards', 'user-1')).toBeNull();
  });

  test('setInCache then getFromCache returns the stored data for that user', () => {
    setInCache('cards', 'user-2', [{ name: 'Sol Ring' }]);
    expect(getFromCache('cards', 'user-2')).toEqual([{ name: 'Sol Ring' }]);
  });

  test('clearCache removes both cards and stats entries for a user', () => {
    setInCache('cards', 'user-3', ['a']);
    setInCache('stats', 'user-3', { totalCards: 1 });
    clearCache('user-3');
    expect(getFromCache('cards', 'user-3')).toBeNull();
    expect(getFromCache('stats', 'user-3')).toBeNull();
  });

  test('different users are cached independently', () => {
    setInCache('cards', 'user-4', ['x']);
    setInCache('cards', 'user-5', ['y']);
    expect(getFromCache('cards', 'user-4')).toEqual(['x']);
    expect(getFromCache('cards', 'user-5')).toEqual(['y']);
  });
});
