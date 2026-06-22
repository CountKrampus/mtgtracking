const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ForumCategory = require('../models/ForumCategory');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('Category tree — batch fetch', () => {
  test('groups children under parents using single batch query', async () => {
    const parent1 = await ForumCategory.create({
      name: 'Parent A', slug: 'parent-a', description: 'x', isActive: true
    });
    const parent2 = await ForumCategory.create({
      name: 'Parent B', slug: 'parent-b', description: 'x', isActive: true
    });
    await ForumCategory.create({
      name: 'Child A1', slug: 'child-a1', description: 'x',
      parentCategoryId: parent1._id, isActive: true
    });
    await ForumCategory.create({
      name: 'Child A2', slug: 'child-a2', description: 'x',
      parentCategoryId: parent1._id, isActive: true
    });
    await ForumCategory.create({
      name: 'Child B1', slug: 'child-b1', description: 'x',
      parentCategoryId: parent2._id, isActive: true
    });

    // The new batch pattern
    const parents = await ForumCategory.find({ parentCategoryId: null, isActive: true })
      .sort({ displayOrder: 1 }).lean();
    const parentIds = parents.map(p => p._id);
    const children = await ForumCategory.find({
      parentCategoryId: { $in: parentIds }, isActive: true
    }).sort({ displayOrder: 1 }).lean();

    const childrenByParent = children.reduce((acc, c) => {
      const key = c.parentCategoryId.toString();
      (acc[key] = acc[key] || []).push(c);
      return acc;
    }, {});

    const tree = parents.map(p => ({
      ...p,
      children: childrenByParent[p._id.toString()] || []
    }));

    const a = tree.find(p => p.slug === 'parent-a');
    const b = tree.find(p => p.slug === 'parent-b');
    expect(a.children).toHaveLength(2);
    expect(b.children).toHaveLength(1);
  });
});
