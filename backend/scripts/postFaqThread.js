require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const ForumThread = require('../models/ForumThread');
const ForumCategory = require('../models/ForumCategory');
const forumCache = require('../cache/forumCache');

const TITLE = 'Frequently Asked Questions (Read Before Posting)';

const CONTENT = `Answers to the questions that come up most. If yours isn't here, post in **General Discussion** or **Bug Reports**/**Feature Requests** as appropriate.

---

### Collection & Pricing

**Why does a card's price look wrong or out of date?**
Prices come from Scryfall first, with MTGGoldfish as a backup if Scryfall doesn't have a price for that printing. Click the dollar-sign icon on a card to refresh its price individually, or use "Update Prices" in the header to refresh in bulk. If you think a price is genuinely wrong (not just stale), use the Flag button on the card to submit a price correction — a moderator will review it.

**How do I update prices for my whole collection at once?**
Click "Update Prices" in the header. By default it only fills in cards missing a price or oracle text. Turn on "Force Update Existing Cards" to refresh everything regardless of existing data, and "Update Full Card Data" to also refresh set info, rarity, colors, types, and the card image — not just the price.

**Can I use this without an internet connection?**
Yes, once cards have been added and their images cached at least once. Enable Offline Mode before bulk importing to skip API calls entirely (minimal data only), and use "Update All Prices" with "Update Full Card Data" later when you're back online to fill in the rest.

**Why did adding a card just bump a quantity instead of adding a new row?**
If a card with the same name, set, and condition already exists in your collection, adding it again increases that row's quantity instead of creating a duplicate. Different set or different condition creates a separate row.

**How do I bulk import a list of cards?**
Click "Import" and select a .txt file, one card per line (\`4 Lightning Bolt\` or just \`Lightning Bolt\`; set codes/collector numbers are stripped automatically). Online mode fetches full data from Scryfall; the Offline Mode checkbox skips that for a faster, connection-free import.

---

### Decks, Wishlist & Trading

**Can I import a deck from Moxfield/Archidekt/TappedOut/MTGGoldfish?**
Yes, both on the website's Deck Builder and via the Discord bot's \`/deck import\` command. Paste the deck URL and you'll get a preview to confirm before it's actually imported.

**What's the difference between the Wishlist and Trading Board?**
Wishlist is personal — cards you want, with a target price; it highlights in green when the current price meets your target. The Trading Board is for trading with other users — post a listing, browse others' listings, and send/receive offers.

**How do power level and salt score work in the Deck Builder?**
Power level (1–10) factors in fast mana, tutors, combo pieces, removal density, average CMC, and deck value. Salt score estimates how much your deck's staples are known to annoy opponents, based on EDHREC community sentiment — it also lists which specific cards are contributing to the score.

---

### Forum

**How do I bookmark a thread?**
Click the bookmark icon in the thread header. Bookmarked threads show up in a dedicated section on your profile page, and clicking one takes you straight back to it.

**Can replies be pinned, or just threads?**
Both. Threads can be pinned/locked by moderators from the thread view; individual replies can also be pinned (gold pin icon) so the most useful answer stays at the top of a long thread — handy for Q&A-style threads.

**Why does creating a thread suggest "possible duplicates"?**
The forum checks new thread titles/content against existing threads to catch accidental re-posts of the same topic. If it's not actually a duplicate, just dismiss the suggestion and your thread posts normally.

**Is there a template I should use for bug reports or feature requests?**
Yes — open the composer directly from the Bug Reports or Feature Requests category and it'll pre-fill a template plus a "Where does this apply?" selector (Main Site + area, or Discord Bot) so reports are easier to triage.

---

### Discord Bot

**How do I link my Discord account to my collection?**
Generate a link code from Settings on the website, then run \`/link <code>\` in Discord. \`/unlink\` removes the connection.

**What can the bot actually do?**
Once linked: look up cards (\`/card\`), manage your collection (\`/add\`, \`/remove\`, \`/update\`, \`/price\`), check decks (\`/decks\`, \`/deck view\`, \`/deck import\`, \`/deckstats\`), get recommendations (\`/similar\`, \`/synergy\`, \`/commander\`), track progress (\`/sets\`, \`/location\`, \`/achievements\`), manage your wishlist (\`/wishlist list|add|remove|deals\`), watch price alerts (\`/pricealerts\`), and trade (\`/trades browse|my-listings|create|offer|sent\`).

**Do I get notified in Discord when a price alert triggers?**
Yes, as a DM from the bot, as long as your account is linked.

---

*This thread will be updated as new features ship. If something here is out of date or you hit something not covered, reply below or open a Bug Report/Feature Request.*`;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const author = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 }).select('_id username');
  if (!author) {
    throw new Error('No admin user found to author the FAQ thread.');
  }

  const category = await ForumCategory.findOne({ slug: 'faq' }).select('_id');
  if (!category) {
    throw new Error('FAQ category not found.');
  }

  const thread = await ForumThread.create({
    categoryId: category._id,
    authorId: author._id,
    title: TITLE,
    content: CONTENT,
    contentFormat: 'markdown',
    isPinned: true,
    tags: ['faq', 'guide']
  });

  await ForumCategory.findByIdAndUpdate(category._id, {
    $inc: { threadCount: 1 },
    lastActivityAt: new Date()
  });

  forumCache.del('categories:tree');

  console.log(`Created FAQ thread ${thread._id} authored by ${author.username}, pinned in FAQ category.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
