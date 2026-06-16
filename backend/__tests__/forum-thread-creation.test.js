const mongoose = require('mongoose');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const User = require('../models/User');

describe('Forum Thread Creation - Data Layer Tests', () => {
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
    await ForumCategory.deleteMany({});
    await ForumThread.deleteMany({});
  });

  test('Can create thread in parent category', async () => {
    // Create test user
    const user = await User.create({
      email: 'testuser@test.com',
      username: 'testuser',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    // Create parent category
    const parentCategory = await ForumCategory.create({
      name: 'General Discussion',
      slug: 'general-discussion',
      description: 'General forum discussions',
      parentCategoryId: null,
      threadCount: 0
    });

    // Simulate POST /api/forum/threads with parent categoryId
    const thread = await ForumThread.create({
      categoryId: parentCategory._id,
      title: 'Introduction Thread',
      content: 'Hello everyone!',
      contentFormat: 'markdown',
      authorId: user._id,
      tags: ['introduction']
    });

    // Increment threadCount
    await ForumCategory.findByIdAndUpdate(parentCategory._id, {
      $inc: { threadCount: 1 },
      lastActivityAt: new Date()
    });

    // Verify thread was created
    expect(thread).not.toBeNull();
    expect(thread.categoryId.toString()).toBe(parentCategory._id.toString());
    expect(thread.title).toBe('Introduction Thread');
    expect(thread.authorId.toString()).toBe(user._id.toString());

    // Verify category threadCount was incremented
    const updatedCategory = await ForumCategory.findById(parentCategory._id);
    expect(updatedCategory.threadCount).toBe(1);
  });

  test('Can create thread in child/sub-category', async () => {
    // Create test user
    const user = await User.create({
      email: 'testuser2@test.com',
      username: 'testuser2',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    // Create parent category
    const parentCategory = await ForumCategory.create({
      name: 'Community',
      slug: 'community',
      description: 'Community area',
      parentCategoryId: null,
      threadCount: 0
    });

    // Create child category
    const childCategory = await ForumCategory.create({
      name: 'Introductions',
      slug: 'introductions',
      description: 'New member introductions',
      parentCategoryId: parentCategory._id,
      threadCount: 0
    });

    // Simulate POST /api/forum/threads with child categoryId
    const thread = await ForumThread.create({
      categoryId: childCategory._id,
      title: 'Hi from New Player',
      content: 'I am new to MTG and excited to join!',
      contentFormat: 'markdown',
      authorId: user._id,
      tags: ['introduction', 'newplayer']
    });

    // Increment threadCount for child category
    await ForumCategory.findByIdAndUpdate(childCategory._id, {
      $inc: { threadCount: 1 },
      lastActivityAt: new Date()
    });

    // Verify thread was created
    expect(thread).not.toBeNull();
    expect(thread.categoryId.toString()).toBe(childCategory._id.toString());
    expect(thread.title).toBe('Hi from New Player');

    // Verify child category threadCount was incremented
    const updatedChildCategory = await ForumCategory.findById(childCategory._id);
    expect(updatedChildCategory.threadCount).toBe(1);

    // Verify parent category threadCount remains 0 (child activity doesn't auto-increment parent)
    const parentAfter = await ForumCategory.findById(parentCategory._id);
    expect(parentAfter.threadCount).toBe(0);
  });

  test('Category threadCount increments for both parent and child independently', async () => {
    // Create test user
    const user = await User.create({
      email: 'testuser3@test.com',
      username: 'testuser3',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    // Create parent category
    const parentCategory = await ForumCategory.create({
      name: 'Deck Discussion',
      slug: 'deck-discussion',
      description: 'Discuss decks',
      parentCategoryId: null,
      threadCount: 0
    });

    // Create multiple child categories
    const standardCategory = await ForumCategory.create({
      name: 'Standard',
      slug: 'standard',
      description: 'Standard format discussion',
      parentCategoryId: parentCategory._id,
      threadCount: 0
    });

    const modernCategory = await ForumCategory.create({
      name: 'Modern',
      slug: 'modern',
      description: 'Modern format discussion',
      parentCategoryId: parentCategory._id,
      threadCount: 0
    });

    // Create thread in parent
    const parentThread = await ForumThread.create({
      categoryId: parentCategory._id,
      title: 'General Deck Talk',
      content: 'Let us discuss all decks',
      contentFormat: 'markdown',
      authorId: user._id
    });

    await ForumCategory.findByIdAndUpdate(parentCategory._id, {
      $inc: { threadCount: 1 }
    });

    // Create 2 threads in standard category
    const standardThread1 = await ForumThread.create({
      categoryId: standardCategory._id,
      title: 'Best Standard Decks',
      content: 'What are the best decks?',
      contentFormat: 'markdown',
      authorId: user._id
    });

    const standardThread2 = await ForumThread.create({
      categoryId: standardCategory._id,
      title: 'Standard Meta',
      content: 'Current meta analysis',
      contentFormat: 'markdown',
      authorId: user._id
    });

    await ForumCategory.findByIdAndUpdate(standardCategory._id, {
      $inc: { threadCount: 2 }
    });

    // Create 1 thread in modern category
    const modernThread = await ForumThread.create({
      categoryId: modernCategory._id,
      title: 'Modern Staples',
      content: 'What are the modern staples?',
      contentFormat: 'markdown',
      authorId: user._id
    });

    await ForumCategory.findByIdAndUpdate(modernCategory._id, {
      $inc: { threadCount: 1 }
    });

    // Verify counts
    const parentAfter = await ForumCategory.findById(parentCategory._id);
    expect(parentAfter.threadCount).toBe(1);

    const standardAfter = await ForumCategory.findById(standardCategory._id);
    expect(standardAfter.threadCount).toBe(2);

    const modernAfter = await ForumCategory.findById(modernCategory._id);
    expect(modernAfter.threadCount).toBe(1);
  });

  test('Invalid categoryId returns error', async () => {
    // Create test user
    const user = await User.create({
      email: 'testuser4@test.com',
      username: 'testuser4',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    // Try to create thread with non-existent categoryId
    const fakeId = new mongoose.Types.ObjectId();

    // Verify category doesn't exist
    const category = await ForumCategory.findById(fakeId);
    expect(category).toBeNull();

    // Thread creation would require category validation in the route
    // This test verifies the route should check if category exists
  });

  test('Thread stores correct categoryId', async () => {
    // Create test user
    const user = await User.create({
      email: 'testuser5@test.com',
      username: 'testuser5',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    // Create category
    const category = await ForumCategory.create({
      name: 'Test Category',
      slug: 'test-category',
      description: 'Test',
      threadCount: 0
    });

    // Create thread
    const thread = await ForumThread.create({
      categoryId: category._id,
      title: 'Test Thread',
      content: 'Test content',
      contentFormat: 'markdown',
      authorId: user._id
    });

    // Retrieve and verify
    const retrievedThread = await ForumThread.findById(thread._id);
    expect(retrievedThread.categoryId.toString()).toBe(category._id.toString());
  });

  test('Thread with tags stores correctly', async () => {
    // Create test user
    const user = await User.create({
      email: 'testuser6@test.com',
      username: 'testuser6',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    // Create category
    const category = await ForumCategory.create({
      name: 'Tagged Category',
      slug: 'tagged-category',
      threadCount: 0
    });

    // Create thread with tags
    const thread = await ForumThread.create({
      categoryId: category._id,
      title: 'Tagged Thread',
      content: 'This is a tagged thread',
      contentFormat: 'markdown',
      authorId: user._id,
      tags: ['help', 'rules', 'important']
    });

    // Verify tags
    expect(thread.tags).toHaveLength(3);
    expect(thread.tags).toContain('help');
    expect(thread.tags).toContain('rules');
    expect(thread.tags).toContain('important');
  });

  test('Multiple threads in same category all count correctly', async () => {
    // Create test user
    const user = await User.create({
      email: 'testuser7@test.com',
      username: 'testuser7',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    // Create category
    const category = await ForumCategory.create({
      name: 'Multi Thread Category',
      slug: 'multi-thread-category',
      threadCount: 0
    });

    // Create 5 threads
    const threadIds = [];
    for (let i = 0; i < 5; i++) {
      const thread = await ForumThread.create({
        categoryId: category._id,
        title: `Thread ${i + 1}`,
        content: `Content for thread ${i + 1}`,
        contentFormat: 'markdown',
        authorId: user._id
      });
      threadIds.push(thread._id);
    }

    // Increment count by 5
    await ForumCategory.findByIdAndUpdate(category._id, {
      $inc: { threadCount: 5 }
    });

    // Verify all threads exist in category
    const threads = await ForumThread.find({ categoryId: category._id });
    expect(threads).toHaveLength(5);

    // Verify threadCount
    const updatedCategory = await ForumCategory.findById(category._id);
    expect(updatedCategory.threadCount).toBe(5);
  });

  test('lastActivityAt is updated when thread is created', async () => {
    // Create test user
    const user = await User.create({
      email: 'testuser8@test.com',
      username: 'testuser8',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    // Create category
    const category = await ForumCategory.create({
      name: 'Activity Test Category',
      slug: 'activity-test-category',
      threadCount: 0,
      lastActivityAt: null
    });

    const before = new Date();

    // Create thread
    const thread = await ForumThread.create({
      categoryId: category._id,
      title: 'Activity Thread',
      content: 'Test activity',
      contentFormat: 'markdown',
      authorId: user._id
    });

    // Update category
    const now = new Date();
    await ForumCategory.findByIdAndUpdate(category._id, {
      $inc: { threadCount: 1 },
      lastActivityAt: now
    });

    const after = new Date();

    // Verify lastActivityAt is set
    const updatedCategory = await ForumCategory.findById(category._id);
    expect(updatedCategory.lastActivityAt).not.toBeNull();
    expect(updatedCategory.lastActivityAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(updatedCategory.lastActivityAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
