const axios = require('axios');
const fs = require('fs');

const deckList = fs.readFileSync(__dirname + '/test-deck.txt', 'utf8');

async function importDeck() {
  try {
    console.log('Importing deck...');
    console.log('Deck list preview:');
    console.log(deckList.split('\n').slice(0, 5).join('\n'));

    // First, import the deck data
    const importResponse = await axios.post('http://localhost:5000/api/decks/import', {
      source: 'text',
      data: deckList
    });

    console.log('Deck parsed successfully!');
    console.log('Commander:', importResponse.data.deckData.commander.name);
    console.log('Main deck cards:', importResponse.data.deckData.mainDeck.length);
    console.log('Validation:', importResponse.data.validation);

    // Now save the deck
    const saveResponse = await axios.post('http://localhost:5000/api/decks', {
      ...importResponse.data.deckData,
      statistics: importResponse.data.statistics
    });

    console.log('\n✅ Deck saved to database!');
    console.log('Deck ID:', saveResponse.data._id);
    console.log('Deck name:', saveResponse.data.name);
    console.log('Total cards:', saveResponse.data.statistics.totalCards);
    console.log('\nOpen http://localhost:3000 and click "Deck Builder" to see it!');

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

importDeck();
