const { syncStaffBadge, STAFF_ROLE_BADGES } = require('../utils/permissions');

describe('STAFF_ROLE_BADGES', () => {
  test('has one entry per staff role with the fixed Site Owner naming', () => {
    expect(STAFF_ROLE_BADGES).toEqual({
      admin: { name: 'Site Owner', description: 'The Creator', icon: 'lucide:Crown' },
      moderator: { name: 'Moderator', description: '', icon: 'lucide:Flame' },
      content_manager: { name: 'Content Manager', description: '', icon: 'lucide:Flame' },
      community_manager: { name: 'Community Manager', description: '', icon: 'lucide:Flame' },
      support: { name: 'Support', description: '', icon: 'lucide:Flame' },
    });
  });
});

describe('syncStaffBadge', () => {
  test('promotion grants the matching staff badge', () => {
    const user = { badges: [] };
    syncStaffBadge(user, 'user', 'moderator');
    expect(user.badges).toHaveLength(1);
    expect(user.badges[0]).toMatchObject({ name: 'Moderator', description: '', icon: 'lucide:Flame' });
    expect(user.badges[0].earnedAt).toBeInstanceOf(Date);
  });

  test('promoting to admin grants "Site Owner", not the legacy "Owner" name', () => {
    const user = { badges: [] };
    syncStaffBadge(user, 'user', 'admin');
    expect(user.badges.map(b => b.name)).toEqual(['Site Owner']);
  });

  test('demotion from a staff role revokes the badge', () => {
    const user = { badges: [{ name: 'Moderator', description: '', icon: 'lucide:Flame', earnedAt: new Date() }] };
    syncStaffBadge(user, 'moderator', 'user');
    expect(user.badges).toEqual([]);
  });

  test('re-promoting to the same role does not duplicate the badge', () => {
    const user = { badges: [{ name: 'Support', description: '', icon: 'lucide:Flame', earnedAt: new Date() }] };
    syncStaffBadge(user, 'support', 'support');
    expect(user.badges).toHaveLength(1);
    expect(user.badges[0].name).toBe('Support');
  });

  test('swapping directly between two staff roles removes the old badge and adds the new one', () => {
    const user = { badges: [{ name: 'Moderator', description: '', icon: 'lucide:Flame', earnedAt: new Date() }] };
    syncStaffBadge(user, 'moderator', 'content_manager');
    expect(user.badges.map(b => b.name)).toEqual(['Content Manager']);
  });

  test('non-staff to non-staff role change is a no-op', () => {
    const user = { badges: [{ name: 'Century Collector', description: '', icon: 'lucide:Package', earnedAt: new Date() }] };
    syncStaffBadge(user, 'user', 'viewer');
    expect(user.badges).toHaveLength(1);
    expect(user.badges[0].name).toBe('Century Collector');
  });

  test('handles a user with no existing badges array', () => {
    const user = {};
    syncStaffBadge(user, 'user', 'support');
    expect(user.badges.map(b => b.name)).toEqual(['Support']);
  });
});
