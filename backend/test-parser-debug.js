const fs = require('fs');

const deckList = fs.readFileSync(__dirname + '/test-deck.txt', 'utf8');

function parseTextList(text) {
  const lines = text.split('\n').filter(line => line.trim());
  let commander = null;
  let partnerCommander = null;
  const mainDeck = [];
  let isCommanderSection = false;

  console.log('Total lines:', lines.length);

  for (const line of lines) {
    console.log('\nProcessing line:', JSON.stringify(line));

    if (/commander:/i.test(line)) {
      isCommanderSection = true;
      console.log('  -> Found commander section header');
      continue;
    }
    if (/deck:|main:|mainboard:/i.test(line)) {
      isCommanderSection = false;
      console.log('  -> Found deck section header');
      continue;
    }

    const match = line.match(/^(\d+)?\s*(.+?)(\s*\*CMDR\*)?$/);
    console.log('  -> Match result:', match);

    if (!match) continue;

    const quantity = parseInt(match[1]) || 1;
    let cardName = match[2].trim();
    const isCommander = match[3] || isCommanderSection;

    console.log('  -> quantity:', quantity);
    console.log('  -> cardName (before cleanup):', cardName);
    console.log('  -> match[3]:', match[3]);
    console.log('  -> isCommander:', isCommander);

    // Remove set codes
    cardName = cardName.replace(/\s*\([A-Z0-9]+\)\s*[A-Z0-9\-]*$/i, '').trim();

    console.log('  -> cardName (after cleanup):', cardName);

    if (isCommander) {
      if (!commander) {
        commander = cardName;
        console.log('  -> Set as commander');
      } else if (!partnerCommander) {
        partnerCommander = cardName;
        console.log('  -> Set as partner commander');
      }
    } else {
      mainDeck.push({ name: cardName, quantity });
      console.log('  -> Added to main deck');
    }
  }

  return { commander, partnerCommander, mainDeck };
}

console.log('First 3 lines:');
console.log(deckList.split('\n').slice(0, 3).join('\n'));
console.log('\n=== PARSING ===\n');

const result = parseTextList(deckList);
console.log('\n=== RESULT ===');
console.log('Commander:', result.commander);
console.log('Partner:', result.partnerCommander);
console.log('Main deck cards:', result.mainDeck.length);
