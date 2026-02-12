const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Cloud MongoDB connection
const CLOUD_URI = 'mongodb+srv://coltongass_db_user:M1gDfkZSXDX6XIAD@mtgcards.hbqvogq.mongodb.net/test';

// Card schema (simplified for export)
const cardSchema = new mongoose.Schema({}, { strict: false, collection: 'cards' });
const Card = mongoose.model('Card', cardSchema);

async function exportData() {
  try {
    console.log('Connecting to cloud database...');
    await mongoose.connect(CLOUD_URI);
    console.log('Connected successfully!');

    console.log('Fetching all cards...');
    const cards = await Card.find({});
    console.log(`Found ${cards.length} cards`);

    console.log('Writing to file...');
    const outputPath = path.join(__dirname, '..', 'cloud-backup.json');
    fs.writeFileSync(outputPath, JSON.stringify(cards, null, 2));
    console.log(`Export complete! Data saved to ${outputPath}`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  }
}

exportData();
