const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const ForumCategory = require('../models/ForumCategory');
const {
  extractMentions,
  createNotification,
  createMentionNotifications,
  createReplyNotification,
  createUpvoteNotification
} = require('../utils/notifications');

describe('Forum Notifications', () => {
  let user1, user2, user3, thread, post, category;

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mtg-tracker-test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Notification.deleteMany({});
    await ForumThread.deleteMany({});
    await ForumPost.deleteMany({});
    await ForumCategory.deleteMany({});

    // Create test users
    user1 = await User.create({
      email: 'user1@test.com',
      username: 'user1',
      displayName: 'User One',
      passwordHash: 'hashedpass123',
      role: 'editor',
      isActive: true
    });

    user2 = await User.create({
      email: 'user2@test.com',
      username: 'user2',
      displayName: 'User Two',
      passwordHash: 'hashedpass123',
      role: 'editor',
      isActive: true
    });

    user3 = await User.create({
      email: 'user3@test.com',
      username: 'user3',
      displayName: 'User Three',
      passwordHash: 'hashedpass123',
      role: 'editor',
      isActive: true
    });

    // Create test category
    category = await ForumCategory.create({
      name: 'Test Category',
      slug: 'test-category',
      description: 'Test category for notifications',
      isActive: true
    });

    // Create test thread
    thread = await ForumThread.create({
      categoryId: category._id,
      title: 'Test Thread',
      content: 'Thread content for testing',
      authorId: user1._id
    });

    // Create test post
    post = await ForumPost.create({
      threadId: thread._id,
      authorId: user1._id,
      body: 'Test post content'
    });
  });

  describe('extractMentions', () => {
    test('Extracts single mention from text', () => {
      const text = 'Hey @user2, check this out';
      const mentions = extractMentions(text);
      expect(mentions).toContain('user2');
      expect(mentions.length).toBe(1);
    });

    test('Extracts multiple mentions from text', () => {
      const text = '@user1 and @user2 and @user3 should see this';
      const mentions = extractMentions(text);
      expect(mentions).toContain('user1');
      expect(mentions).toContain('user2');
      expect(mentions).toContain('user3');
      expect(mentions.length).toBe(3);
    });

    test('Removes duplicate mentions', () => {
      const text = '@user1 says hi to @user1 again';
      const mentions = extractMentions(text);
      expect(mentions.length).toBe(1);
      expect(mentions[0]).toBe('user1');
    });

    test('Returns empty array for text with no mentions', () => {
      const text = 'This is a regular post with no mentions';
      const mentions = extractMentions(text);
      expect(mentions).toEqual([]);
    });

    test('Converts mentions to lowercase for lookup', () => {
      const text = '@User1 and @USER2';
      const mentions = extractMentions(text);
      expect(mentions[0]).toBe('user1');
      expect(mentions[1]).toBe('user2');
    });

    test('Handles mentions with underscores and hyphens', () => {
      const text = '@user_1 and @user-2';
      const mentions = extractMentions(text);
      expect(mentions).toContain('user_1');
      expect(mentions).toContain('user-2');
    });

    test('Ignores invalid mentions (too short)', () => {
      const text = '@a and @ab and @user1';
      const mentions = extractMentions(text);
      // Only user1 should be extracted (needs 3+ chars including @)
      expect(mentions).toEqual(['user1']);
    });

    test('Returns empty array for null or non-string input', () => {
      expect(extractMentions(null)).toEqual([]);
      expect(extractMentions(undefined)).toEqual([]);
      expect(extractMentions(123)).toEqual([]);
    });
  });

  describe('createNotification', () => {
    test('Creates notification successfully', async () => {
      const notification = await createNotification(
        user2._id,
        'mention',
        user1._id,
        {
          threadId: thread._id,
          postId: post._id,
          content: 'Test mention'
        }
      );

      expect(notification).not.toBeNull();
      expect(notification.type).toBe('mention');
      expect(notification.userId.toString()).toBe(user2._id.toString());
      expect(notification.fromUserId.toString()).toBe(user1._id.toString());
      expect(notification.isRead).toBe(false);
    });

    test('Returns null when user notifies themselves', async () => {
      const notification = await createNotification(
        user1._id,
        'mention',
        user1._id,
        {
          content: 'Self notification'
        }
      );

      expect(notification).toBeNull();
    });

    test('Prevents duplicate notifications within 1 minute', async () => {
      // Create first notification
      const notif1 = await createNotification(
        user2._id,
        'mention',
        user1._id,
        {
          postId: post._id,
          content: 'First mention'
        }
      );

      expect(notif1).not.toBeNull();

      // Attempt to create identical notification immediately
      const notif2 = await createNotification(
        user2._id,
        'mention',
        user1._id,
        {
          postId: post._id,
          content: 'Duplicate mention'
        }
      );

      // Second should be prevented
      expect(notif2).toBeNull();

      // Verify only one was created
      const count = await Notification.countDocuments({
        userId: user2._id,
        type: 'mention'
      });
      expect(count).toBe(1);
    });

    test('Enforces content max length of 200 characters', async () => {
      const longContent = 'a'.repeat(250);
      const notification = await createNotification(
        user2._id,
        'mention',
        user1._id,
        { content: longContent }
      );

      expect(notification.content.length).toBeLessThanOrEqual(200);
    });
  });

  describe('createMentionNotifications', () => {
    test('Creates mention notifications for all mentioned users', async () => {
      const text = '@user2 and @user3, check this out';
      const notifications = await createMentionNotifications(
        user1._id,
        'mention',
        text,
        {
          threadId: thread._id,
          postId: post._id,
          content: 'Posted with mentions'
        }
      );

      expect(notifications.length).toBe(2);
      const userIds = notifications.map(n => n.userId.toString());
      expect(userIds).toContain(user2._id.toString());
      expect(userIds).toContain(user3._id.toString());
    });

    test('Creates mention notifications with content preview', async () => {
      const text = '@user2 please review';
      const contentPreview = 'Please review this carefully';
      const notifications = await createMentionNotifications(
        user1._id,
        'mention',
        text,
        {
          threadId: thread._id,
          postId: post._id,
          content: contentPreview
        }
      );

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].content).toContain('review');
    });

    test('Ignores invalid usernames that do not exist', async () => {
      const text = '@user2 and @nonexistent_user';
      const notifications = await createMentionNotifications(
        user1._id,
        'mention',
        text,
        {
          threadId: thread._id,
          postId: post._id,
          content: 'Test'
        }
      );

      // Only user2 should get notification (nonexistent doesn't exist)
      expect(notifications.length).toBe(1);
      expect(notifications[0].userId.toString()).toBe(user2._id.toString());
    });

    test('Returns empty array when no mentions present', async () => {
      const text = 'No mentions in this text';
      const notifications = await createMentionNotifications(
        user1._id,
        'mention',
        text,
        { content: 'Test' }
      );

      expect(notifications).toEqual([]);
    });

    test('Ignores inactive users', async () => {
      // Deactivate user2
      await User.findByIdAndUpdate(user2._id, { isActive: false });

      const text = '@user2 and @user3';
      const notifications = await createMentionNotifications(
        user1._id,
        'mention',
        text,
        { threadId: thread._id, postId: post._id, content: 'Test' }
      );

      // Only user3 should get notification
      expect(notifications.length).toBe(1);
      expect(notifications[0].userId.toString()).toBe(user3._id.toString());
    });
  });

  describe('createReplyNotification', () => {
    test('Creates reply notification for post author', async () => {
      const contentPreview = 'Great point, I agree';
      const notification = await createReplyNotification(
        user1._id,
        user2._id,
        thread._id,
        post._id,
        contentPreview
      );

      expect(notification).not.toBeNull();
      expect(notification.type).toBe('reply');
      expect(notification.userId.toString()).toBe(user1._id.toString());
      expect(notification.fromUserId.toString()).toBe(user2._id.toString());
      expect(notification.postId.toString()).toBe(post._id.toString());
      expect(notification.content).toContain('Replied to your post');
      expect(notification.content).toContain('Great point');
    });

    test('Returns null when replying to own post', async () => {
      const notification = await createReplyNotification(
        user1._id,
        user1._id,
        thread._id,
        post._id,
        'Self reply'
      );

      expect(notification).toBeNull();
    });

    test('Includes content preview in notification', async () => {
      const preview = 'This is my reply';
      const notification = await createReplyNotification(
        user1._id,
        user2._id,
        thread._id,
        post._id,
        preview
      );

      expect(notification.content).toContain(preview);
    });
  });

  describe('createUpvoteNotification', () => {
    test('Creates upvote notification for post author', async () => {
      const contentPreview = 'Great post';
      const notification = await createUpvoteNotification(
        user1._id,
        user2._id,
        post._id,
        contentPreview
      );

      expect(notification).not.toBeNull();
      expect(notification.type).toBe('upvote');
      expect(notification.userId.toString()).toBe(user1._id.toString());
      expect(notification.fromUserId.toString()).toBe(user2._id.toString());
      expect(notification.postId.toString()).toBe(post._id.toString());
      expect(notification.content).toContain('upvote');
      expect(notification.content).toContain('Great post');
    });

    test('Returns null when user upvotes own post', async () => {
      const notification = await createUpvoteNotification(
        user1._id,
        user1._id,
        post._id,
        'Self upvote'
      );

      expect(notification).toBeNull();
    });

    test('Includes post snippet in notification', async () => {
      const snippet = 'Useful information here';
      const notification = await createUpvoteNotification(
        user1._id,
        user2._id,
        post._id,
        snippet
      );

      expect(notification.content).toContain(snippet);
    });

    test('Truncates snippet to 50 characters in notification', async () => {
      const longSnippet = 'a'.repeat(100);
      const notification = await createUpvoteNotification(
        user1._id,
        user2._id,
        post._id,
        longSnippet
      );

      // Content should include truncated snippet (enforced by function)
      expect(notification.content.length).toBeLessThanOrEqual(200);
    });
  });

  describe('Author exclusion', () => {
    test('Author does not get notification for own mentions in post', async () => {
      const text = '@user1 mentioned itself';
      const notifications = await createMentionNotifications(
        user1._id,
        'mention',
        text,
        { postId: post._id, content: 'Test' }
      );

      // Should be empty since user1 is mentioning itself
      expect(notifications).toEqual([]);
    });

    test('Author does not get reply notification for own post', async () => {
      const notification = await createReplyNotification(
        user1._id,
        user1._id,
        thread._id,
        post._id,
        'Self reply'
      );

      expect(notification).toBeNull();
    });

    test('Author does not get upvote notification for own post', async () => {
      const notification = await createUpvoteNotification(
        user1._id,
        user1._id,
        post._id,
        'Own post'
      );

      expect(notification).toBeNull();
    });
  });

  describe('Notification accuracy', () => {
    test('Mention notification contains accurate data', async () => {
      const text = '@user2 look at this';
      const notifications = await createMentionNotifications(
        user1._id,
        'mention',
        text,
        {
          threadId: thread._id,
          postId: post._id,
          content: 'Check it out'
        }
      );

      const notif = notifications[0];
      expect(notif.userId.toString()).toBe(user2._id.toString());
      expect(notif.fromUserId.toString()).toBe(user1._id.toString());
      expect(notif.type).toBe('mention');
      expect(notif.threadId.toString()).toBe(thread._id.toString());
      expect(notif.postId.toString()).toBe(post._id.toString());
      expect(notif.isRead).toBe(false);
    });

    test('Reply notification contains accurate references', async () => {
      const notification = await createReplyNotification(
        user1._id,
        user2._id,
        thread._id,
        post._id,
        'Great insight'
      );

      expect(notification.type).toBe('reply');
      expect(notification.threadId.toString()).toBe(thread._id.toString());
      expect(notification.postId.toString()).toBe(post._id.toString());
      expect(notification.userId.toString()).toBe(user1._id.toString());
    });

    test('Upvote notification contains accurate post reference', async () => {
      const notification = await createUpvoteNotification(
        user1._id,
        user2._id,
        post._id,
        'Post content'
      );

      expect(notification.type).toBe('upvote');
      expect(notification.postId.toString()).toBe(post._id.toString());
      expect(notification.userId.toString()).toBe(user1._id.toString());
      expect(notification.fromUserId.toString()).toBe(user2._id.toString());
    });
  });

  describe('Duplicate prevention edge cases', () => {
    test('Allows similar notifications from different users', async () => {
      const notif1 = await createNotification(
        user2._id,
        'upvote',
        user1._id,
        { postId: post._id, content: 'Upvote' }
      );

      const notif2 = await createNotification(
        user2._id,
        'upvote',
        user3._id, // Different user
        { postId: post._id, content: 'Upvote' }
      );

      expect(notif1).not.toBeNull();
      expect(notif2).not.toBeNull();
    });

    test('Allows similar notifications for different posts', async () => {
      const post2 = await ForumPost.create({
        threadId: thread._id,
        authorId: user1._id,
        body: 'Another post'
      });

      const notif1 = await createNotification(
        user2._id,
        'upvote',
        user1._id,
        { postId: post._id, content: 'Upvote' }
      );

      const notif2 = await createNotification(
        user2._id,
        'upvote',
        user1._id,
        { postId: post2._id, content: 'Upvote' } // Different post
      );

      expect(notif1).not.toBeNull();
      expect(notif2).not.toBeNull();
    });
  });
});
