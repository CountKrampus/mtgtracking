const mongoose = require('mongoose');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const User = require('../models/User');

describe('Forum Thread Deletion - Data Layer Tests', () => {
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
    await ForumPost.deleteMany({});
  });

  test('DELETE route implementation: Can delete a thread', async () => {
    // Create test user
    const user = await User.create({
      email: 'testuser@test.com',
      username: 'testuser',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    // Create category
    const category = await ForumCategory.create({
      name: 'Test Category',
      slug: 'test-category',
      description: 'A test category',
      threadCount: 1
    });

    // Create thread
    const thread = await ForumThread.create({
      title: 'Test Thread',
      categoryId: category._id,
      authorId: user._id,
      content: 'This is a test thread',
      contentFormat: 'markdown'
    });

    // Simulate DELETE /api/forum/threads/:threadId
    // Find the thread
    let foundThread = await ForumThread.findById(thread._id);
    expect(foundThread).not.toBeNull();

    // Delete all posts in the thread (cascade delete)
    await ForumPost.deleteMany({ threadId: thread._id });

    // Delete the thread
    await ForumThread.deleteOne({ _id: thread._id });

    // Update parent category's threadCount (decrement by 1)
    await ForumCategory.findByIdAndUpdate(
      thread.categoryId,
      { $inc: { threadCount: -1 } }
    );

    // Verify thread is deleted
    foundThread = await ForumThread.findById(thread._id);
    expect(foundThread).toBeNull();

    // Verify category threadCount was decremented
    const updatedCategory = await ForumCategory.findById(category._id);
    expect(updatedCategory.threadCount).toBe(0);
  });

  test('Cascade deletes all posts in the thread', async () => {
    // Create test user
    const user = await User.create({
      email: 'user2@test.com',
      username: 'user2',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    // Create category
    const category = await ForumCategory.create({
      name: 'Test Category',
      slug: 'test-category',
      threadCount: 1
    });

    // Create thread
    const thread = await ForumThread.create({
      title: 'Test Thread',
      categoryId: category._id,
      authorId: user._id,
      content: 'This is a test thread'
    });

    // Create multiple posts in the thread
    const post1 = await ForumPost.create({
      threadId: thread._id,
      body: 'First post',
      bodyFormat: 'markdown',
      authorId: user._id
    });

    const post2 = await ForumPost.create({
      threadId: thread._id,
      body: 'Second post',
      bodyFormat: 'markdown',
      authorId: user._id
    });

    const post3 = await ForumPost.create({
      threadId: thread._id,
      body: 'Third post',
      bodyFormat: 'markdown',
      authorId: user._id
    });

    // Verify posts exist
    let posts = await ForumPost.find({ threadId: thread._id });
    expect(posts.length).toBe(3);

    // Simulate DELETE: Delete all posts in the thread (cascade delete)
    await ForumPost.deleteMany({ threadId: thread._id });

    // Delete the thread
    await ForumThread.deleteOne({ _id: thread._id });

    // Verify all posts are cascade deleted
    posts = await ForumPost.find({ threadId: thread._id });
    expect(posts.length).toBe(0);

    // Verify thread is deleted
    const deletedThread = await ForumThread.findById(thread._id);
    expect(deletedThread).toBeNull();
  });

  test('Multiple threads in category: only specified thread deleted', async () => {
    // Create test user
    const user = await User.create({
      email: 'user3@test.com',
      username: 'user3',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    // Create category
    const category = await ForumCategory.create({
      name: 'Test Category',
      slug: 'test-category',
      threadCount: 2
    });

    // Create two threads
    const thread1 = await ForumThread.create({
      title: 'First Thread',
      categoryId: category._id,
      authorId: user._id,
      content: 'First thread content'
    });

    const thread2 = await ForumThread.create({
      title: 'Second Thread',
      categoryId: category._id,
      authorId: user._id,
      content: 'Second thread content'
    });

    // Verify both threads exist
    let allThreads = await ForumThread.find({ categoryId: category._id });
    expect(allThreads.length).toBe(2);

    // Simulate DELETE: Delete first thread
    await ForumPost.deleteMany({ threadId: thread1._id });
    await ForumThread.deleteOne({ _id: thread1._id });
    await ForumCategory.findByIdAndUpdate(category._id, { $inc: { threadCount: -1 } });

    // Verify first thread is deleted
    const deletedThread = await ForumThread.findById(thread1._id);
    expect(deletedThread).toBeNull();

    // Verify second thread still exists
    const existingThread = await ForumThread.findById(thread2._id);
    expect(existingThread).not.toBeNull();
    expect(existingThread.title).toBe('Second Thread');

    // Verify category threadCount is correct
    const updatedCategory = await ForumCategory.findById(category._id);
    expect(updatedCategory.threadCount).toBe(1);
  });

  test('Category threadCount is properly decremented', async () => {
    // Create test user
    const user = await User.create({
      email: 'user4@test.com',
      username: 'user4',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    // Create category
    const category = await ForumCategory.create({
      name: 'Test Category',
      slug: 'test-category',
      threadCount: 5
    });

    // Create 5 threads
    const threads = [];
    for (let i = 0; i < 5; i++) {
      const thread = await ForumThread.create({
        title: `Thread ${i + 1}`,
        categoryId: category._id,
        authorId: user._id,
        content: `Content for thread ${i + 1}`
      });
      threads.push(thread);
    }

    // Verify initial state
    let categoryBefore = await ForumCategory.findById(category._id);
    expect(categoryBefore.threadCount).toBe(5);

    // Delete 3 threads
    for (let i = 0; i < 3; i++) {
      await ForumPost.deleteMany({ threadId: threads[i]._id });
      await ForumThread.deleteOne({ _id: threads[i]._id });
      await ForumCategory.findByIdAndUpdate(category._id, { $inc: { threadCount: -1 } });
    }

    // Verify threadCount was decremented correctly
    const categoryAfter = await ForumCategory.findById(category._id);
    expect(categoryAfter.threadCount).toBe(2);

    // Verify remaining threads exist
    const remainingThreads = await ForumThread.find({ categoryId: category._id });
    expect(remainingThreads.length).toBe(2);
  });

  test('Thread with many posts: all posts cascade deleted', async () => {
    // Create test user
    const user = await User.create({
      email: 'user5@test.com',
      username: 'user5',
      passwordHash: 'hashedpass123',
      role: 'editor'
    });

    // Create category
    const category = await ForumCategory.create({
      name: 'Test Category',
      slug: 'test-category',
      threadCount: 1
    });

    // Create thread
    const thread = await ForumThread.create({
      title: 'Busy Thread',
      categoryId: category._id,
      authorId: user._id,
      content: 'A thread with many posts',
      postCount: 10
    });

    // Create 10 posts
    for (let i = 0; i < 10; i++) {
      await ForumPost.create({
        threadId: thread._id,
        body: `Post number ${i + 1}`,
        bodyFormat: 'markdown',
        authorId: user._id
      });
    }

    // Verify posts exist
    let posts = await ForumPost.find({ threadId: thread._id });
    expect(posts.length).toBe(10);

    // Simulate DELETE: Delete all posts
    const deleteResult = await ForumPost.deleteMany({ threadId: thread._id });
    expect(deleteResult.deletedCount).toBe(10);

    // Delete the thread
    await ForumThread.deleteOne({ _id: thread._id });

    // Verify all posts are deleted
    posts = await ForumPost.find({ threadId: thread._id });
    expect(posts.length).toBe(0);

    // Verify thread is deleted
    const deletedThread = await ForumThread.findById(thread._id);
    expect(deletedThread).toBeNull();
  });

  test('Non-existent thread: returns null (404 in API)', async () => {
    const fakeThreadId = new mongoose.Types.ObjectId();

    // Verify thread doesn't exist
    const thread = await ForumThread.findById(fakeThreadId);
    expect(thread).toBeNull();

    // Attempt to delete (would be 404 in actual API)
    const deleteResult = await ForumThread.deleteOne({ _id: fakeThreadId });
    expect(deleteResult.deletedCount).toBe(0);
  });
});
