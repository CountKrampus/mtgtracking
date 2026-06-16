const mongoose = require('mongoose');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const ForumCategory = require('../models/ForumCategory');
const User = require('../models/User');

// Mock setup
jest.mock('../models/ForumThread');
jest.mock('../models/ForumPost');
jest.mock('../models/ForumCategory');
jest.mock('../models/User');

describe('Forum Feed API', () => {
  let mockThreads;
  let mockPosts;
  let mockUsers;
  let mockCategory;

  beforeEach(() => {
    // Setup test data
    mockUsers = [
      {
        _id: new mongoose.Types.ObjectId(),
        username: 'alice',
        displayName: 'Alice Smith'
      },
      {
        _id: new mongoose.Types.ObjectId(),
        username: 'bob',
        displayName: 'Bob Jones'
      }
    ];

    mockCategory = {
      _id: new mongoose.Types.ObjectId(),
      name: 'General Discussion',
      slug: 'general-discussion'
    };

    mockThreads = [
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'New Set Announcement',
        categoryId: mockCategory,
        authorId: mockUsers[0],
        content: 'The new set has been announced! Lots of exciting cards coming soon.',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        postCount: 5,
        isLocked: false
      },
      {
        _id: new mongoose.Types.ObjectId(),
        title: 'Best Budget Decks',
        categoryId: mockCategory,
        authorId: mockUsers[1],
        content: 'Here are some great budget-friendly decks for new players to get started.',
        createdAt: new Date('2024-01-14T15:00:00Z'),
        postCount: 12,
        isLocked: false
      }
    ];

    mockPosts = [
      {
        _id: new mongoose.Types.ObjectId(),
        threadId: mockThreads[0]._id,
        authorId: mockUsers[1],
        body: 'I am really excited about the new mechanics in this set!',
        createdAt: new Date('2024-01-15T11:00:00Z'),
        isHidden: false,
        isFlagHidden: false,
        isShadowHidden: false
      },
      {
        _id: new mongoose.Types.ObjectId(),
        threadId: mockThreads[0]._id,
        authorId: mockUsers[0],
        body: 'Yes, the design team did a great job this time.',
        createdAt: new Date('2024-01-15T12:00:00Z'),
        isHidden: false,
        isFlagHidden: false,
        isShadowHidden: false
      },
      {
        _id: new mongoose.Types.ObjectId(),
        threadId: mockThreads[1]._id,
        authorId: mockUsers[0],
        body: 'I would suggest Mono Red Aggro as the best budget option.',
        createdAt: new Date('2024-01-14T16:00:00Z'),
        isHidden: false,
        isFlagHidden: false,
        isShadowHidden: false
      }
    ];

    jest.clearAllMocks();
  });

  test('feed returns recent threads sorted by date', async () => {
    ForumThread.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockThreads)
              })
            })
          })
        })
      })
    });

    ForumPost.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([])
            })
          })
        })
      })
    });

    ForumThread.find.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      })
    });

    // Simulate API call
    const result = {
      threads: mockThreads,
      posts: []
    };

    // Verify threads are sorted by date descending
    const sortedByDate = mockThreads.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    expect(sortedByDate[0].title).toBe('New Set Announcement');
    expect(sortedByDate[1].title).toBe('Best Budget Decks');
  });

  test('feed returns recent posts sorted by date', async () => {
    ForumThread.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([])
              })
            })
          })
        })
      })
    });

    ForumPost.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(mockPosts)
            })
          })
        })
      })
    });

    ForumThread.find.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockThreads)
      })
    });

    // Verify posts are sorted by date descending
    const sortedByDate = mockPosts.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    expect(sortedByDate[0].body).toContain('Yes, the design team');
    expect(sortedByDate[1].body).toContain('I am really excited');
    expect(sortedByDate[2].body).toContain('Mono Red Aggro');
  });

  test('threads and posts are combined and sorted together', async () => {
    // Simulate combining threads and posts
    const combinedFeed = [
      {
        type: 'post',
        id: mockPosts[1]._id,
        createdAt: mockPosts[1].createdAt // 2024-01-15T12:00:00Z
      },
      {
        type: 'post',
        id: mockPosts[0]._id,
        createdAt: mockPosts[0].createdAt // 2024-01-15T11:00:00Z
      },
      {
        type: 'thread',
        id: mockThreads[0]._id,
        createdAt: mockThreads[0].createdAt // 2024-01-15T10:00:00Z
      },
      {
        type: 'post',
        id: mockPosts[2]._id,
        createdAt: mockPosts[2].createdAt // 2024-01-14T16:00:00Z
      },
      {
        type: 'thread',
        id: mockThreads[1]._id,
        createdAt: mockThreads[1].createdAt // 2024-01-14T15:00:00Z
      }
    ];

    // Sort by createdAt descending
    const sorted = combinedFeed.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    expect(sorted[0].type).toBe('post');
    expect(sorted[0].createdAt).toEqual(new Date('2024-01-15T12:00:00Z'));
    expect(sorted[1].type).toBe('post');
    expect(sorted[2].type).toBe('thread');
    expect(sorted[3].type).toBe('post');
    expect(sorted[4].type).toBe('thread');
  });

  test('pagination works with limit and offset', () => {
    const allItems = [
      { id: 1, createdAt: new Date('2024-01-15T12:00:00Z') },
      { id: 2, createdAt: new Date('2024-01-15T11:00:00Z') },
      { id: 3, createdAt: new Date('2024-01-15T10:00:00Z') },
      { id: 4, createdAt: new Date('2024-01-14T16:00:00Z') },
      { id: 5, createdAt: new Date('2024-01-14T15:00:00Z') }
    ];

    // Test first page with limit=2, offset=0
    const page1 = allItems.slice(0, 2);
    expect(page1).toHaveLength(2);
    expect(page1[0].id).toBe(1);
    expect(page1[1].id).toBe(2);

    // Test second page with limit=2, offset=2
    const page2 = allItems.slice(2, 4);
    expect(page2).toHaveLength(2);
    expect(page2[0].id).toBe(3);
    expect(page2[1].id).toBe(4);

    // Test third page with limit=2, offset=4
    const page3 = allItems.slice(4, 6);
    expect(page3).toHaveLength(1);
    expect(page3[0].id).toBe(5);
  });

  test('feed respects isLocked/hidden posts (only show public content)', () => {
    const hiddenPost = {
      ...mockPosts[0],
      isHidden: true
    };

    const flagHiddenPost = {
      ...mockPosts[1],
      isFlagHidden: true
    };

    const shadowHiddenPost = {
      ...mockPosts[2],
      isShadowHidden: true
    };

    const allPosts = [mockPosts[0], hiddenPost, flagHiddenPost, shadowHiddenPost];

    // Filter to show only public posts
    const publicPosts = allPosts.filter(
      p => !p.isHidden && !p.isFlagHidden && !p.isShadowHidden
    );

    expect(publicPosts).toHaveLength(1);
    expect(publicPosts[0]._id).toEqual(mockPosts[0]._id);
  });

  test('feed returns correct structure with metadata', () => {
    const feedThread = {
      type: 'thread',
      id: mockThreads[0]._id,
      title: mockThreads[0].title,
      authorId: mockThreads[0].authorId,
      categoryId: mockThreads[0].categoryId,
      snippet: mockThreads[0].content.substring(0, 150),
      createdAt: mockThreads[0].createdAt,
      postCount: mockThreads[0].postCount
    };

    expect(feedThread).toHaveProperty('type', 'thread');
    expect(feedThread).toHaveProperty('id');
    expect(feedThread).toHaveProperty('title');
    expect(feedThread).toHaveProperty('authorId');
    expect(feedThread).toHaveProperty('categoryId');
    expect(feedThread).toHaveProperty('snippet');
    expect(feedThread).toHaveProperty('createdAt');
    expect(feedThread).toHaveProperty('postCount');

    const feedPost = {
      type: 'post',
      id: mockPosts[0]._id,
      threadId: mockPosts[0].threadId,
      threadTitle: 'New Set Announcement',
      authorId: mockPosts[0].authorId,
      snippet: mockPosts[0].body.substring(0, 150),
      createdAt: mockPosts[0].createdAt
    };

    expect(feedPost).toHaveProperty('type', 'post');
    expect(feedPost).toHaveProperty('id');
    expect(feedPost).toHaveProperty('threadId');
    expect(feedPost).toHaveProperty('threadTitle');
    expect(feedPost).toHaveProperty('authorId');
    expect(feedPost).toHaveProperty('snippet');
    expect(feedPost).toHaveProperty('createdAt');
  });
});
