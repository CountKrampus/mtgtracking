const { parseTextList } = require('./utils/deckHelpers');
const fs = require('fs');

const deckList = fs.readFileSync(__dirname + '/test-deck.txt', 'utf8');

console.log('Testing parser...');
console.log('First 5 lines:');
console.log(deckList.split('\n').slice(0, 5).join('\n'));
console.log('\n');

const result = parseTextList(deckList);
console.log('Parse result:');
console.log('Commander:', result.commander);
console.log('Partner:', result.partnerCommander);
console.log('Main deck cards:', result.mainDeck.length);
console.log('First few main deck cards:', result.mainDeck.slice(0, 3));
