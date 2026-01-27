const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Local MongoDB connection
const LOCAL_URI = 'mongodb://localhost:27017/mtg-tracker';

// Card schema (simplified for import)
const cardSchema = new mongoose.Schema({}, { strict: false, collection: 'cards' });
const Card = mongoose.model('Card', cardSchema);

async function importData() {
  try {
    console.log('Connecting to local database...');
    await mongoose.connect(LOCAL_URI);
    console.log('Connected successfully!');

    console.log('Reading backup file...');
    const backupPath = path.join(__dirname, '..', 'cloud-backup.json');
    const cardsData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    console.log(`Found ${cardsData.length} cards to import`);

    console.log('Clearing existing data in local database...');
    await Card.deleteMany({});

    console.log('Importing cards...');
    await Card.insertMany(cardsData);
    console.log(`Successfully imported ${cardsData.length} cards!`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

importData();
