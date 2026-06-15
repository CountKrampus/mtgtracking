const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ForumCategory = require('../models/ForumCategory');

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const defaultCategories = [
  {
    name: 'Site & Rules',
    description: 'Forum rules, site updates, and important information',
    emoji: '📋',
    displayOrder: 1,
    children: [
      { name: 'Forum Rules', description: 'Community guidelines and rules', emoji: '📜', displayOrder: 1 },
      { name: 'Site Updates', description: 'App updates, new features, maintenance', emoji: '📢', displayOrder: 2 },
      { name: 'FAQ', description: 'Frequently asked questions', emoji: '❓', displayOrder: 3 },
      { name: 'Important Info', description: 'Critical announcements and information', emoji: '⚠️', displayOrder: 4 },
    ]
  },
  {
    name: 'Getting Started',
    description: 'Help using the tracker and asking questions',
    emoji: '🎯',
    displayOrder: 2,
    children: [
      { name: 'Help & Support', description: 'Questions about using the tracker app', emoji: '🆘', displayOrder: 1 },
      { name: 'Feature Requests', description: 'Suggest new features', emoji: '⭐', displayOrder: 2 },
      { name: 'Bug Reports', description: 'Report issues and bugs', emoji: '🐛', displayOrder: 3 },
    ]
  },
  {
    name: 'Community',
    description: 'Community discussion and announcements',
    emoji: '👥',
    displayOrder: 3,
    children: [
      { name: 'General Discussion', description: 'General MTG and Magic discussion', emoji: '💬', displayOrder: 1 },
      { name: 'Format Discussion', description: 'Discuss MTG formats and rules', emoji: '🎴', displayOrder: 2 },
      { name: 'Deck Ideas', description: 'Share and discuss deck ideas', emoji: '🃏', displayOrder: 3 },
      { name: 'Market & Trading', description: 'Buy, sell, and trade cards', emoji: '💳', displayOrder: 4 },
    ]
  },
  {
    name: 'Events & Tournaments',
    description: 'Community events, tournaments, and game nights',
    emoji: '🏆',
    displayOrder: 4,
    children: [
      { name: 'Tournaments', description: 'Organize and discuss tournaments', emoji: '🥇', displayOrder: 1 },
      { name: 'Game Nights', description: 'Casual game night scheduling', emoji: '🎲', displayOrder: 2 },
      { name: 'Community Events', description: 'Special community events', emoji: '🎉', displayOrder: 3 },
    ]
  }
];

// Add slugs to all categories
defaultCategories.forEach(cat => {
  cat.slug = slugify(cat.name);
  if (cat.children) {
    cat.children.forEach(child => {
      child.slug = slugify(child.name);
    });
  }
});

async function seedCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing categories
    await ForumCategory.deleteMany({});
    console.log('Cleared existing categories');

    // Create parent categories with children
    for (const catData of defaultCategories) {
      const { children, ...parentData } = catData;

      // Create parent first
      const parent = await ForumCategory.create(parentData);

      // Create children with parent reference
      if (children && children.length > 0) {
        for (const childData of children) {
          await ForumCategory.create({
            ...childData,
            parentCategoryId: parent._id
          });
        }
      }

      console.log(`✅ Created category: ${parent.name} with ${children?.length || 0} children`);
    }

    console.log('\n✅ Forum categories seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    process.exit(1);
  }
}

seedCategories();
