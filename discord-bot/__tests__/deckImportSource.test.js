const { detectDeckImportSource, SUPPORTED_SITES } = require('../src/lib/deckImportSource');

describe('detectDeckImportSource', () => {
  test('detects Moxfield URLs', () => {
    expect(detectDeckImportSource('https://moxfield.com/decks/abc123')).toBe('moxfield');
    expect(detectDeckImportSource('https://www.moxfield.com/decks/abc123')).toBe('moxfield');
  });

  test('detects Archidekt URLs', () => {
    expect(detectDeckImportSource('https://archidekt.com/decks/123456')).toBe('archidekt');
  });

  test('detects TappedOut URLs', () => {
    expect(detectDeckImportSource('https://tappedout.net/mtg-decks/my-deck/')).toBe('tappedout');
  });

  test('detects MTGGoldfish URLs', () => {
    expect(detectDeckImportSource('https://www.mtggoldfish.com/deck/1234567')).toBe('mtggoldfish');
  });

  test('is case-insensitive', () => {
    expect(detectDeckImportSource('HTTPS://MOXFIELD.COM/decks/abc123')).toBe('moxfield');
  });

  test('returns null for an unsupported or unrecognized URL', () => {
    expect(detectDeckImportSource('https://example.com/decks/abc123')).toBeNull();
    expect(detectDeckImportSource('not a url at all')).toBeNull();
  });

  test('exports the list of supported site labels for error messages', () => {
    expect(SUPPORTED_SITES).toEqual(['Moxfield', 'Archidekt', 'TappedOut', 'MTGGoldfish']);
  });

  test('does not match lookalike hosts that merely contain a supported domain as a substring', () => {
    expect(detectDeckImportSource('https://eviltappedout.net/mtg-decks/my-deck/')).toBeNull();
    expect(detectDeckImportSource('https://notmoxfield.com/decks/abc123')).toBeNull();
    expect(detectDeckImportSource('https://short.link/r?u=moxfield.com/decks/1')).toBeNull();
  });

  test('still matches a bare (non-www) domain and any real subdomain', () => {
    expect(detectDeckImportSource('https://moxfield.com/decks/abc123')).toBe('moxfield');
    expect(detectDeckImportSource('https://cdn.archidekt.com/decks/123456')).toBe('archidekt');
  });
});
