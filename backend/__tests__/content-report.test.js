const { computeSuggestedAction } = require('../models/ContentReport');

describe('computeSuggestedAction', () => {
  it('returns hide_post for automated source', () => {
    expect(computeSuggestedAction('automated', 'other', 0)).toBe('hide_post');
  });

  it('returns hide_and_warn for harassment reason', () => {
    expect(computeSuggestedAction('user', 'harassment', 0)).toBe('hide_and_warn');
  });

  it('returns hide_and_warn for spam reason', () => {
    expect(computeSuggestedAction('user', 'spam', 0)).toBe('hide_and_warn');
  });

  it('returns hide_post when pendingCount >= 3', () => {
    expect(computeSuggestedAction('user', 'other', 3)).toBe('hide_post');
  });

  it('returns hide_post when pendingCount > 3', () => {
    expect(computeSuggestedAction('user', 'off-topic', 5)).toBe('hide_post');
  });

  it('returns review as default', () => {
    expect(computeSuggestedAction('user', 'other', 0)).toBe('review');
  });

  it('returns review for off-topic with pendingCount < 3', () => {
    expect(computeSuggestedAction('user', 'off-topic', 2)).toBe('review');
  });

  it('automated source takes priority over pendingCount check', () => {
    expect(computeSuggestedAction('automated', 'off-topic', 1)).toBe('hide_post');
  });
});
