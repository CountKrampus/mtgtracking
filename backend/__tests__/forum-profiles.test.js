const mongoose = require('mongoose');
const User = require('../models/User');

describe('User Forum Privacy Settings', () => {
  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mtg-tracker-test';
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Clear users collection
    await User.deleteMany({});
  });

  test('User.privacy defaults are set correctly', async () => {
    const user = new User({
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: 'hashedpass123'
    });

    await user.save();

    const savedUser = await User.findById(user._id);
    expect(savedUser.privacy).toBeDefined();
    expect(savedUser.privacy.isPublic).toBe(false);
    expect(savedUser.privacy.showCollection).toBe(false);
    expect(savedUser.privacy.showDecks).toBe(true);
    expect(savedUser.privacy.showWishlist).toBe(false);
    expect(savedUser.privacy.showForum).toBe(false);
    expect(savedUser.privacy.bio).toBe('');
  });

  test('User.privacy fields can be customized', async () => {
    const user = new User({
      email: 'test2@example.com',
      username: 'testuser2',
      passwordHash: 'hashedpass123',
      privacy: {
        isPublic: true,
        showCollection: true,
        showDecks: false,
        showWishlist: true,
        showForum: true,
        bio: 'This is my bio'
      }
    });

    await user.save();

    const savedUser = await User.findById(user._id);
    expect(savedUser.privacy.isPublic).toBe(true);
    expect(savedUser.privacy.showCollection).toBe(true);
    expect(savedUser.privacy.showDecks).toBe(false);
    expect(savedUser.privacy.showWishlist).toBe(true);
    expect(savedUser.privacy.showForum).toBe(true);
    expect(savedUser.privacy.bio).toBe('This is my bio');
  });
});
