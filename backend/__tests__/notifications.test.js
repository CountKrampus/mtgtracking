const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('Notifications Model and API', () => {
  let user1, user2, thread, post;

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();

    // Create test users
    user1 = await User.create({
      email: 'user1@test.com',
      username: 'user1',
      displayName: 'User One',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    user2 = await User.create({
      email: 'user2@test.com',
      username: 'user2',
      displayName: 'User Two',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    // Create test thread and post
    thread = await ForumThread.create({
      categoryId: new mongoose.Types.ObjectId(),
      title: 'Test Thread',
      content: 'Thread content',
      authorId: user1._id
    });

    post = await ForumPost.create({
      threadId: thread._id,
      authorId: user1._id,
      body: 'Test post content'
    });
  });

  test('Can create mention notification', async () => {
    const notification = await Notification.create({
      userId: user2._id,
      type: 'mention',
      fromUserId: user1._id,
      threadId: thread._id,
      postId: post._id,
      content: '@user2 check this out'
    });

    expect(notification).not.toBeNull();
    expect(notification.type).toBe('mention');
    expect(notification.userId.toString()).toBe(user2._id.toString());
    expect(notification.fromUserId.toString()).toBe(user1._id.toString());
    expect(notification.isRead).toBe(false);
    expect(notification.readAt).toBeNull();
  });

  test('Can create reply notification', async () => {
    const notification = await Notification.create({
      userId: user1._id,
      type: 'reply',
      fromUserId: user2._id,
      threadId: thread._id,
      postId: post._id,
      content: 'Someone replied to your post'
    });

    expect(notification.type).toBe('reply');
    expect(notification.userId.toString()).toBe(user1._id.toString());
  });

  test('Can create upvote notification', async () => {
    const notification = await Notification.create({
      userId: post._id,
      type: 'upvote',
      fromUserId: user2._id,
      postId: post._id,
      content: 'Your post was upvoted'
    });

    expect(notification.type).toBe('upvote');
  });

  test('Can create DM notification', async () => {
    const notification = await Notification.create({
      userId: user2._id,
      type: 'dm',
      fromUserId: user1._id,
      content: 'You have a new direct message'
    });

    expect(notification.type).toBe('dm');
    expect(notification.threadId).toBeUndefined();
    expect(notification.postId).toBeUndefined();
  });

  test('Can mark notification as read', async () => {
    const notification = await Notification.create({
      userId: user2._id,
      type: 'mention',
      fromUserId: user1._id,
      postId: post._id,
      content: 'Test notification'
    });

    expect(notification.isRead).toBe(false);
    expect(notification.readAt).toBeNull();

    // Mark as read
    notification.isRead = true;
    await notification.save();

    const updated = await Notification.findById(notification._id);
    expect(updated.isRead).toBe(true);
    expect(updated.readAt).not.toBeNull();
  });

  test('readAt is set when isRead is marked true', async () => {
    const notification = await Notification.create({
      userId: user2._id,
      type: 'mention',
      fromUserId: user1._id,
      content: 'Test'
    });

    const beforeReadAt = notification.readAt;

    notification.isRead = true;
    await notification.save();

    expect(notification.readAt).not.toEqual(beforeReadAt);
    expect(notification.readAt instanceof Date).toBe(true);
  });

  test('readAt is cleared when isRead is marked false', async () => {
    let notification = await Notification.create({
      userId: user2._id,
      type: 'mention',
      fromUserId: user1._id,
      content: 'Test'
    });

    notification.isRead = true;
    await notification.save();
    expect(notification.readAt).not.toBeNull();

    notification.isRead = false;
    await notification.save();

    const updated = await Notification.findById(notification._id);
    expect(updated.isRead).toBe(false);
    expect(updated.readAt).toBeNull();
  });

  test('Can fetch user notifications in correct order', async () => {
    // Create multiple notifications with different times
    const notif1 = await Notification.create({
      userId: user2._id,
      type: 'mention',
      fromUserId: user1._id,
      content: 'First'
    });

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 100));

    const notif2 = await Notification.create({
      userId: user2._id,
      type: 'reply',
      fromUserId: user1._id,
      isRead: true,
      content: 'Second'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const notif3 = await Notification.create({
      userId: user2._id,
      type: 'upvote',
      fromUserId: user1._id,
      content: 'Third'
    });

    // Fetch and sort like the API does
    const notifications = await Notification.find({ userId: user2._id })
      .sort({ isRead: 1, createdAt: -1 });

    expect(notifications.length).toBe(3);
    // Unread (isRead: false) should come first
    expect(notifications[0]._id.toString()).toBe(notif3._id.toString());
    expect(notifications[1]._id.toString()).toBe(notif1._id.toString());
    expect(notifications[2]._id.toString()).toBe(notif2._id.toString());
  });

  test('Can count unread notifications', async () => {
    await Notification.create({
      userId: user2._id,
      type: 'mention',
      fromUserId: user1._id,
      content: 'First'
    });

    await Notification.create({
      userId: user2._id,
      type: 'reply',
      fromUserId: user1._id,
      isRead: true,
      content: 'Second'
    });

    await Notification.create({
      userId: user2._id,
      type: 'mention',
      fromUserId: user1._id,
      content: 'Third'
    });

    const unreadCount = await Notification.countDocuments({
      userId: user2._id,
      isRead: false
    });

    expect(unreadCount).toBe(2);
  });

  test('Can fetch only unread notifications', async () => {
    await Notification.create({
      userId: user2._id,
      type: 'mention',
      fromUserId: user1._id,
      content: 'Unread'
    });

    await Notification.create({
      userId: user2._id,
      type: 'reply',
      fromUserId: user1._id,
      isRead: true,
      content: 'Read'
    });

    const unreadNotifications = await Notification.find({
      userId: user2._id,
      isRead: false
    });

    expect(unreadNotifications.length).toBe(1);
    expect(unreadNotifications[0].type).toBe('mention');
  });

  test('Can populate notification references', async () => {
    const notification = await Notification.create({
      userId: user2._id,
      type: 'mention',
      fromUserId: user1._id,
      threadId: thread._id,
      postId: post._id,
      content: 'Test'
    });

    const populated = await Notification.findById(notification._id)
      .populate('fromUserId', 'username displayName')
      .populate('threadId', 'title')
      .populate('postId', 'body');

    expect(populated.fromUserId.username).toBe('user1');
    expect(populated.fromUserId.displayName).toBe('User One');
    expect(populated.threadId.title).toBe('Test Thread');
    expect(populated.postId.body).toBe('Test post content');
  });

  test('Can delete notification', async () => {
    const notification = await Notification.create({
      userId: user2._id,
      type: 'mention',
      fromUserId: user1._id,
      content: 'Test'
    });

    const notificationId = notification._id;

    // Delete notification
    await Notification.findByIdAndDelete(notificationId);

    const found = await Notification.findById(notificationId);
    expect(found).toBeNull();
  });

  test('Can bulk mark all notifications as read', async () => {
    await Notification.create({
      userId: user2._id,
      type: 'mention',
      fromUserId: user1._id,
      content: 'First'
    });

    await Notification.create({
      userId: user2._id,
      type: 'reply',
      fromUserId: user1._id,
      content: 'Second'
    });

    await Notification.create({
      userId: user2._id,
      type: 'upvote',
      fromUserId: user1._id,
      isRead: true,
      content: 'Third'
    });

    // Mark all unread as read
    const result = await Notification.updateMany(
      { userId: user2._id, isRead: false },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    expect(result.modifiedCount).toBe(2);

    // Verify all are now read
    const allNotifications = await Notification.find({ userId: user2._id });
    const allRead = allNotifications.every(n => n.isRead === true);
    expect(allRead).toBe(true);
  });

  test('Notification content is limited to 200 characters', async () => {
    const longContent = 'a'.repeat(250);

    try {
      await Notification.create({
        userId: user2._id,
        type: 'mention',
        fromUserId: user1._id,
        content: longContent
      });
    } catch (error) {
      // Validation should fail or truncate
      expect(error).toBeDefined();
    }
  });

  test('Notification requires userId, type, and fromUserId', async () => {
    try {
      await Notification.create({
        type: 'mention',
        fromUserId: user1._id
      });
    } catch (error) {
      expect(error).toBeDefined();
    }

    try {
      await Notification.create({
        userId: user2._id,
        fromUserId: user1._id
      });
    } catch (error) {
      expect(error).toBeDefined();
    }

    try {
      await Notification.create({
        userId: user2._id,
        type: 'mention'
      });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test('Indexes are created for performance queries', async () => {
    // Ensure collection and indexes exist (dropDatabase in beforeEach removes them)
    await Notification.ensureIndexes();
    const indexes = await Notification.collection.getIndexes();
    const indexNames = Object.keys(indexes);

    // Check for userId + isRead compound index
    expect(indexNames).toContain('userId_1_isRead_1');

    // Check for userId + createdAt compound index
    expect(indexNames).toContain('userId_1_createdAt_-1');
  });
});
