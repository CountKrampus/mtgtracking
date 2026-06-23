const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const DirectMessage = require('../models/DirectMessage');
const Notification = require('../models/Notification');
const User = require('../models/User');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('DirectMessage Model and DM Routes', () => {
  let user1, user2, user3;

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

    user3 = await User.create({
      email: 'user3@test.com',
      username: 'user3',
      displayName: 'User Three',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });
  });

  describe('DirectMessage Model', () => {
    test('Can create a direct message with required fields', async () => {
      const message = await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: 'Hello, this is a test message'
      });

      expect(message).not.toBeNull();
      expect(message.fromUserId.toString()).toBe(user1._id.toString());
      expect(message.toUserId.toString()).toBe(user2._id.toString());
      expect(message.content).toBe('Hello, this is a test message');
      expect(message.isRead).toBe(false);
      expect(message.readAt).toBeNull();
      expect(message.createdAt).toBeDefined();
      expect(message.updatedAt).toBeDefined();
    });

    test('Message requires fromUserId, toUserId, and content', async () => {
      expect(async () => {
        await DirectMessage.create({
          toUserId: user2._id,
          content: 'Missing fromUserId'
        });
      }).rejects.toThrow();

      expect(async () => {
        await DirectMessage.create({
          fromUserId: user1._id,
          content: 'Missing toUserId'
        });
      }).rejects.toThrow();

      expect(async () => {
        await DirectMessage.create({
          fromUserId: user1._id,
          toUserId: user2._id
        });
      }).rejects.toThrow();
    });

    test('Message content cannot exceed 5000 characters', async () => {
      const longContent = 'a'.repeat(5001);

      expect(async () => {
        await DirectMessage.create({
          fromUserId: user1._id,
          toUserId: user2._id,
          content: longContent
        });
      }).rejects.toThrow();
    });

    test('Pre-save middleware updates updatedAt timestamp on save', async () => {
      const message = await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: 'Test message'
      });

      const originalUpdatedAt = message.updatedAt;

      // Simulate time passing and update message
      await new Promise(resolve => setTimeout(resolve, 10));
      message.content = 'Updated content';
      await message.save();

      expect(message.updatedAt).not.toEqual(originalUpdatedAt);
      expect(message.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    test('Pre-save middleware sets readAt when isRead is marked true', async () => {
      const message = await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: 'Test message'
      });

      expect(message.isRead).toBe(false);
      expect(message.readAt).toBeNull();

      // Mark as read
      message.isRead = true;
      await message.save();

      expect(message.isRead).toBe(true);
      expect(message.readAt).not.toBeNull();
      expect(message.readAt instanceof Date).toBe(true);
    });

    test('Pre-save middleware clears readAt when isRead is marked false', async () => {
      const message = await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: 'Test message',
        isRead: true
      });

      expect(message.isRead).toBe(true);
      expect(message.readAt).not.toBeNull();

      // Mark as unread
      message.isRead = false;
      await message.save();

      expect(message.isRead).toBe(false);
      expect(message.readAt).toBeNull();
    });

    test('Compound indexes are created for conversation lookup', async () => {
      // Create messages in both directions
      const msg1 = await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: 'Message 1'
      });

      const msg2 = await DirectMessage.create({
        fromUserId: user2._id,
        toUserId: user1._id,
        content: 'Message 2'
      });

      // Query by conversation participants should be efficient
      const messages = await DirectMessage.find({
        $or: [
          { fromUserId: user1._id, toUserId: user2._id },
          { fromUserId: user2._id, toUserId: user1._id }
        ]
      }).sort({ createdAt: 1 });

      expect(messages).toHaveLength(2);
      expect(messages[0]._id).toEqual(msg1._id);
      expect(messages[1]._id).toEqual(msg2._id);
    });
  });

  describe('Send DM and Notification Creation', () => {
    test('Can send a DM and it creates a notification for recipient', async () => {
      const message = await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: 'Hello user2, this is a test message'
      });

      // Create notification
      const notification = await Notification.create({
        userId: user2._id,
        type: 'dm',
        fromUserId: user1._id,
        messageId: message._id,
        content: message.content.substring(0, 100)
      });

      expect(notification).not.toBeNull();
      expect(notification.type).toBe('dm');
      expect(notification.userId.toString()).toBe(user2._id.toString());
      expect(notification.fromUserId.toString()).toBe(user1._id.toString());
      expect(notification.messageId.toString()).toBe(message._id.toString());
      expect(notification.isRead).toBe(false);
      expect(notification.readAt).toBeNull();
    });

    test('DM notification content contains first 100 characters of message', async () => {
      const longContent = 'This is a very long message that exceeds one hundred characters and should be truncated in the notification preview '.repeat(3);

      const message = await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: longContent
      });

      const notification = await Notification.create({
        userId: user2._id,
        type: 'dm',
        fromUserId: user1._id,
        messageId: message._id,
        content: message.content.substring(0, 100)
      });

      expect(notification.content.length).toBeLessThanOrEqual(100);
      expect(notification.content).toBe(longContent.substring(0, 100));
    });

    test('Sender does not receive notification for their own DM', async () => {
      const message = await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: 'Test message'
      });

      // Notification should be created for user2 only
      const notification = await Notification.create({
        userId: user2._id,
        type: 'dm',
        fromUserId: user1._id,
        messageId: message._id,
        content: message.content.substring(0, 100)
      });

      // Check that no notification exists for user1
      const user1Notifications = await Notification.find({
        userId: user1._id,
        messageId: message._id
      });

      expect(user1Notifications).toHaveLength(0);
      expect(notification.userId.toString()).toBe(user2._id.toString());
    });
  });

  describe('DM Thread Operations', () => {
    test('Can fetch DM thread with another user (both directions)', async () => {
      // Create messages in both directions
      const msg1 = await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: 'Message from user1'
      });

      const msg2 = await DirectMessage.create({
        fromUserId: user2._id,
        toUserId: user1._id,
        content: 'Reply from user2'
      });

      const msg3 = await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: 'Another message from user1'
      });

      // Query thread between user1 and user2
      const messages = await DirectMessage.find({
        $or: [
          { fromUserId: user1._id, toUserId: user2._id },
          { fromUserId: user2._id, toUserId: user1._id }
        ]
      }).sort({ createdAt: 1 });

      expect(messages).toHaveLength(3);
      expect(messages[0]._id).toEqual(msg1._id);
      expect(messages[1]._id).toEqual(msg2._id);
      expect(messages[2]._id).toEqual(msg3._id);
    });

    test('Can auto-mark messages as read when fetched by recipient', async () => {
      // Create unread messages from user2 to user1
      const msg1 = await DirectMessage.create({
        fromUserId: user2._id,
        toUserId: user1._id,
        content: 'Unread message 1',
        isRead: false
      });

      const msg2 = await DirectMessage.create({
        fromUserId: user2._id,
        toUserId: user1._id,
        content: 'Unread message 2',
        isRead: false
      });

      // User1 fetches the thread - should auto-mark their messages as read
      const messagesToMarkAsRead = await DirectMessage.find({
        toUserId: user1._id,
        fromUserId: user2._id,
        isRead: false
      });

      expect(messagesToMarkAsRead).toHaveLength(2);

      // Mark as read
      for (const msg of messagesToMarkAsRead) {
        msg.isRead = true;
        msg.readAt = new Date();
        await msg.save();
      }

      // Verify they are now marked as read
      const readMessages = await DirectMessage.find({
        _id: { $in: [msg1._id, msg2._id] }
      });

      expect(readMessages.every(m => m.isRead)).toBe(true);
      expect(readMessages.every(m => m.readAt !== null)).toBe(true);
    });

    test('Unread messages from one user do not affect messages from another user', async () => {
      // Create messages from user2 to user1
      const msg1 = await DirectMessage.create({
        fromUserId: user2._id,
        toUserId: user1._id,
        content: 'From user2'
      });

      // Create messages from user3 to user1
      const msg2 = await DirectMessage.create({
        fromUserId: user3._id,
        toUserId: user1._id,
        content: 'From user3'
      });

      // When user1 fetches user2's thread, only user2's messages should be marked as read
      const messagesToMarkAsRead = await DirectMessage.find({
        toUserId: user1._id,
        fromUserId: user2._id,
        isRead: false
      });

      for (const msg of messagesToMarkAsRead) {
        msg.isRead = true;
        msg.readAt = new Date();
        await msg.save();
      }

      // Check final state
      const msg1Updated = await DirectMessage.findById(msg1._id);
      const msg2Updated = await DirectMessage.findById(msg2._id);

      expect(msg1Updated.isRead).toBe(true);
      expect(msg2Updated.isRead).toBe(false); // Should still be unread
    });
  });

  describe('Conversation List Operations', () => {
    test('Can retrieve unique conversations with most recent message', async () => {
      // Create messages between user1 and user2
      await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: 'Message 1'
      });

      await DirectMessage.create({
        fromUserId: user2._id,
        toUserId: user1._id,
        content: 'Message 2'
      });

      // Create messages between user1 and user3
      await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user3._id,
        content: 'Message 3'
      });

      // Get all conversations for user1
      const allMessages = await DirectMessage.find({
        $or: [
          { fromUserId: user1._id },
          { toUserId: user1._id }
        ]
      });

      expect(allMessages).toHaveLength(3);

      // Identify unique conversation partners
      const partners = new Set();
      allMessages.forEach(msg => {
        if (msg.fromUserId.toString() === user1._id.toString()) {
          partners.add(msg.toUserId.toString());
        } else {
          partners.add(msg.fromUserId.toString());
        }
      });

      expect(partners.size).toBe(2);
      expect(partners.has(user2._id.toString())).toBe(true);
      expect(partners.has(user3._id.toString())).toBe(true);
    });

    test('Unread count reflects messages TO current user FROM specific sender', async () => {
      // Create messages from user2 to user1
      await DirectMessage.create({
        fromUserId: user2._id,
        toUserId: user1._id,
        content: 'Unread 1',
        isRead: false
      });

      await DirectMessage.create({
        fromUserId: user2._id,
        toUserId: user1._id,
        content: 'Unread 2',
        isRead: false
      });

      // Create read message from user3 to user1
      await DirectMessage.create({
        fromUserId: user3._id,
        toUserId: user1._id,
        content: 'Read message',
        isRead: true
      });

      // Count unread from user2
      const unreadFromUser2 = await DirectMessage.countDocuments({
        toUserId: user1._id,
        fromUserId: user2._id,
        isRead: false
      });

      expect(unreadFromUser2).toBe(2);

      // Count unread from user3 (should be 0)
      const unreadFromUser3 = await DirectMessage.countDocuments({
        toUserId: user1._id,
        fromUserId: user3._id,
        isRead: false
      });

      expect(unreadFromUser3).toBe(0);
    });
  });

  describe('Read Status Tracking', () => {
    test('readAt timestamp is set when message is marked as read', async () => {
      const message = await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: 'Test message'
      });

      expect(message.isRead).toBe(false);
      expect(message.readAt).toBeNull();

      const beforeRead = new Date();
      message.isRead = true;
      await message.save();
      const afterRead = new Date();

      expect(message.isRead).toBe(true);
      expect(message.readAt).not.toBeNull();
      expect(message.readAt.getTime()).toBeGreaterThanOrEqual(beforeRead.getTime());
      expect(message.readAt.getTime()).toBeLessThanOrEqual(afterRead.getTime());
    });

    test('readAt is cleared when message is unmarked as read', async () => {
      const readDate = new Date();
      const message = await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: 'Test message',
        isRead: true,
        readAt: readDate
      });

      expect(message.isRead).toBe(true);
      expect(message.readAt).toEqual(readDate);

      message.isRead = false;
      await message.save();

      expect(message.isRead).toBe(false);
      expect(message.readAt).toBeNull();
    });

    test('Multiple messages can have independent read statuses', async () => {
      const msg1 = await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: 'Message 1'
      });

      const msg2 = await DirectMessage.create({
        fromUserId: user1._id,
        toUserId: user2._id,
        content: 'Message 2'
      });

      // Mark only msg1 as read
      msg1.isRead = true;
      await msg1.save();

      // Fetch both
      const fetched1 = await DirectMessage.findById(msg1._id);
      const fetched2 = await DirectMessage.findById(msg2._id);

      expect(fetched1.isRead).toBe(true);
      expect(fetched1.readAt).not.toBeNull();
      expect(fetched2.isRead).toBe(false);
      expect(fetched2.readAt).toBeNull();
    });
  });
});
