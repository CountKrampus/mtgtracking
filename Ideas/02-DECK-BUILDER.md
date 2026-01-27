# Deck Builder Ideas

## High Priority

### Core Deck Building
- **Deck Validation**: Validate decks against format rules (Commander: exactly 100, singleton, color identity; Standard: 60+ main, 15 sideboard, legal cards)
- **Format Support**: Add format selection (Commander, Standard, Modern, Pioneer, Legacy, Vintage, Pauper, Draft) with legality checking
- **Card Legality Checker**: Show ban/restrict status per format using Scryfall data; highlight illegal cards in red
- **Drag-and-Drop Deck Building**: Drag cards from collection into deck slots; drag between main deck and sideboard
- **Card Categories in Deck**: Auto-sort deck into categories (Creatures, Instants, Sorceries, Enchantments, Artifacts, Lands, Planeswalkers)
- **Land Base Calculator**: Suggest optimal land count and color distribution based on deck's mana curve and color requirements
- **Mana Base Analysis**: Analyze if the deck has enough color sources per color requirement (e.g., "You need 14 blue sources, you have 11")

### Deck Analysis
- **Mana Curve Chart Improvements**: Interactive mana curve — click a bar to see all cards at that CMC
- **Color Pie Chart**: Visual breakdown of deck's color distribution
- **Card Type Distribution Chart**: Pie/bar chart showing creature vs spell vs land ratios
- **Opening Hand Simulator**: Draw 7 random cards and simulate mulligans (London mulligan rule)
- **Goldfish Simulator**: Step through turns drawing cards to test deck flow
- **Deck Comparison**: Compare two decks side-by-side to see differences
- **Deck Versioning / History**: Track changes to a deck over time; revert to previous versions
- **Win Rate Tracking**: Log game results per deck and track win rates over time

### Deck Sharing
- **Export to Moxfield/Archidekt**: One-click export deck to popular deck-building sites
- **Export to MTGO/Arena Format**: Export deck list in formats compatible with Magic Online or Arena
- **Shareable Deck Links**: Generate a link to share your deck list (read-only view)
- **Deck QR Code**: Generate a QR code that links to the deck list for sharing at game stores
- **Print Deck List**: Clean printable deck list with card names, quantities, and categories

## Medium Priority

### Smart Suggestions
- **Card Suggestions Based on Deck**: Analyze deck theme/strategy and suggest cards from your collection that would fit
- **Upgrade Suggestions**: For budget decks, suggest higher-value upgrades from your collection
- **Staple Cards Reminder**: Flag if deck is missing common staples for its format/colors (Sol Ring in Commander, etc.)
- **Mana Rock Suggestions**: Suggest mana rocks/ramp based on deck colors and curve
- **Removal Suite Check**: Warn if deck lacks sufficient removal (board wipes, spot removal, counterspells)
- **Draw Engine Check**: Warn if deck lacks sufficient card draw
- **"Cards You Own" Indicator**: When browsing suggestions, show which ones are already in your collection

### Deck Building Tools
- **Deck Templates**: Pre-built deck skeletons for common archetypes (Aggro: X creatures, Y removal, Z lands)
- **Budget Tracking**: Show total deck cost; highlight expensive cards; suggest budget alternatives
- **Proxy List Generator**: Generate list of cards you don't own for proxying (cards in deck but not in collection)
- **Sideboard Guide Creator**: Create and save sideboard plans for different matchups
- **Deck Tagging**: Tag decks with themes/archetypes for easy organization (Aggro, Control, Combo, Tribal)
- **Deck Folders**: Organize decks into folders (Active, Retired, Ideas, Borrowed)

### Commander-Specific
- **EDHREC Integration**: Pull popular cards and themes for a commander directly from EDHREC data
- **Commander Tax Tracker**: Track commander tax during games (integrate with life counter)
- **Partner Commander Suggestions**: When picking one partner, suggest complementary partners
- **Precon Upgrade Paths**: Given a precon commander, suggest cards from collection to upgrade it
- **Color Identity Warnings**: Alert when adding cards outside commander's color identity

## Lower Priority

- **Deck Primer / Notes**: Rich text area for writing deck strategy guides, combos, and matchup notes
- **Playtest Mode**: Full playtest simulator with library, hand, battlefield zones
- **AI Deck Suggestions**: Use LLM to suggest deck improvements based on strategy description
- **Deck Archetypes Database**: Curated list of common archetypes with example lists
- **Deck Price History**: Track deck value over time as card prices change
- **Tournament Deck Import**: Import tournament-winning deck lists from MTGTop8 or similar
- **Deck Difficulty Rating**: Rate deck complexity (beginner-friendly to expert) based on card interactions
- **Companion Checker**: Auto-detect if deck qualifies for any companion card
