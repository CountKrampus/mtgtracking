const { slimVariant, peekComboIndex, __setTestIndex } = require('../utils/comboDatabase');

describe('slimVariant', () => {
  test('extracts distinct card names from uses objects with card payloads', () => {
    const slim = slimVariant({
      id: 'v1',
      uses: [
        { card: { name: 'Sol Ring' } },
        { card: { name: 'Isochron Scepter' } },
      ],
    });
    expect(slim).toEqual({ id: 'v1', cards: ['Sol Ring', 'Isochron Scepter'] });
  });

  test('supports flat name entries and plain string entries', () => {
    const slim = slimVariant({
      id: 'v2',
      uses: [{ name: 'Dramatic Reversal' }, 'Arcane Signet'],
    });
    expect(slim.cards).toEqual(['Dramatic Reversal', 'Arcane Signet']);
  });

  test('dedupes repeated card names case-insensitively', () => {
    const slim = slimVariant({
      id: 'v3',
      uses: [{ card: { name: 'Sol Ring' } }, { card: { name: 'sol ring' } }, { card: { name: 'Basalt Monolith' } }],
    });
    expect(slim.cards).toEqual(['Sol Ring', 'Basalt Monolith']);
  });

  test('drops variants with fewer than 2 distinct cards', () => {
    expect(slimVariant({ id: 'v4', uses: [{ card: { name: 'Sol Ring' } }] })).toBeNull();
    expect(slimVariant({ id: 'v5', uses: [] })).toBeNull();
    expect(slimVariant({ id: 'v6' })).toBeNull();
  });

  test('falls back to the cards array format', () => {
    const slim = slimVariant({ id: 'v7', cards: ['A', 'B'].map(n => ({ name: n })) });
    expect(slim.cards).toEqual(['A', 'B']);
  });
});

describe('peekComboIndex', () => {
  test('null by default, injected value after set, null after cleanup', () => {
    expect(peekComboIndex()).toBeNull();
    const restore = __setTestIndex([{ id: 'x', cards: ['One', 'Two'] }]);
    expect(peekComboIndex()).toHaveLength(1);
    restore();
    expect(peekComboIndex()).toBeNull();
  });
});
