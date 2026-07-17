const { getPermissionsCatalog } = require('../utils/permissions');

describe('getPermissionsCatalog', () => {
  test('returns permissions grouped by domain, including the new admin-domain permissions', () => {
    const catalog = getPermissionsCatalog();
    const allKeys = Object.values(catalog).flat().map(p => p.key);

    expect(Object.keys(catalog)).toEqual(
      expect.arrayContaining([
        'User Management', 'Roles & Permissions', 'Forum & Community',
        'Pricing & Data', 'System', 'Collection & Decks', 'Chat'
      ])
    );

    expect(allKeys).toEqual(expect.arrayContaining([
      'user:ban', 'user:appeal:review', 'user:role:manage', 'roles:manage',
      'forum:moderate', 'badges:manage', 'system:settings:manage', 'prices:force-update',
      'decks:moderate', 'trades:moderate',
      'chat:moderate', 'comments:moderate', 'user:warn', 'user:mute', 'content:flag',
      'cards:audit', 'prices:manage', 'data:export', 'community:events',
      'announcements:manage', 'feedback:manage', 'playgroups:manage',
      'user:view', 'feedback:read', 'ticket:manage',
      'collection:manage', 'deck:create', 'community:chat', 'collection:view'
    ]));
  });

  test('every catalog entry has a string key and label', () => {
    const catalog = getPermissionsCatalog();
    for (const group of Object.values(catalog)) {
      for (const entry of group) {
        expect(typeof entry.key).toBe('string');
        expect(typeof entry.label).toBe('string');
        expect(entry.label.length).toBeGreaterThan(0);
      }
    }
  });
});
