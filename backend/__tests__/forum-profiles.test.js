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

  test('User.privacy.showForum defaults to false', async () => {
    const user = new User({
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: 'hashedpass123'
    });

    await user.save();

    const savedUser = await User.findById(user._id);
    expect(savedUser.privacy).toBeDefined();
    expect(savedUser.privacy.showForum).toBe(false);
  });

  test('User.privacy.showForum can be set to true', async () => {
    const user = new User({
      email: 'test2@example.com',
      username: 'testuser2',
      passwordHash: 'hashedpass123',
      privacy: {
        showForum: true
      }
    });

    await user.save();

    const savedUser = await User.findById(user._id);
    expect(savedUser.privacy.showForum).toBe(true);
  });
});
