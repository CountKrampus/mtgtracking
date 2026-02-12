# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MTG Tracker is a full-stack web application for tracking Magic: The Gathering card collections. The application integrates with Scryfall API for card data (images, types, colors, mana cost) and scrapes Exor Games for local pricing.

**Stack:**
- Backend: Node.js + Express + MongoDB (Mongoose)
- Frontend: React (Create React App) + Tailwind CSS
- External APIs:
  - Scryfall API for MTG card data (images, types, colors, mana cost)
  - Exor Games (exorgames.com) for Canadian pricing via web scraping

## Development Commands

### Backend (from `backend/` directory)
```bash
npm install              # Install dependencies
npm start               # Start production server (port 5000)
npm run dev             # Start development server with nodemon
```

### Frontend (from `frontend/` directory)
```bash
npm install             # Install dependencies
npm start               # Start development server (port 3000)
npm run build           # Build for production
npm test                # Run tests
```

### Full Application (Root directory)
```bash
npm install             # Install root dependencies (concurrently package)
npm start               # Cross-platform - starts both backend and frontend simultaneously

# Platform-specific scripts:
start.bat               # Windows - starts both servers in separate windows
./start.sh              # Linux/Mac - starts both servers (Ctrl+C to stop)
```

## Architecture

### Backend Structure (`backend/server.js`)

The backend is a single-file Express application with the following components:

1. **MongoDB Schema (Card)**
   - Stores card collection data including name, set, quantity, condition, price, colors, types, mana cost, and Scryfall metadata
   - Condition values: 'NM', 'LP', 'MP', 'HP', 'DMG'
   - Auto-updates `updatedAt` timestamp on save via pre-save middleware

2. **API Routes**
   - `GET /api/cards` - Fetch all cards (sorted by name)
   - `GET /api/cards/:id` - Fetch single card by ID
   - `POST /api/cards` - Create new card OR auto-merge with existing (see duplicate handling below)
   - `PUT /api/cards/:id` - Update existing card
   - `DELETE /api/cards/:id` - Delete card
   - `POST /api/cards/bulk-update` - Bulk update multiple cards (condition, location, tags)
   - `DELETE /api/cards/bulk-delete` - Bulk delete multiple cards
   - `GET /api/scryfall/autocomplete?q={query}` - Autocomplete card names from Scryfall
   - `GET /api/scryfall/search?name={name}` - Search Scryfall for full card data
   - `POST /api/cards/:id/update-price` - Update single card price (supports `?force=true` and `?fullData=true`)
   - `POST /api/cards/update-all-prices` - Bulk update all card prices (with 500ms rate limiting, supports `?force=true` and `?fullData=true`)
   - `POST /api/cards/bulk-import` - Bulk import cards from text list (supports online with Scryfall or offline fallback)
   - `POST /api/cards/bulk-import-offline` - Bulk import cards without API calls (offline mode, minimal data)
   - `GET /api/export/json` - Export collection as JSON (all fields)
   - `GET /api/export/csv` - Export collection as CSV (all 21 fields including setCode, rarity, tags, location, etc.)
   - `GET /api/stats` - Get collection statistics (total cards, value, color/type distribution)
   - `GET /api/images/:scryfallId` - Serve cached card images from local storage (for offline use)
   - **Locations API**:
     - `GET /api/locations` - Get all storage locations
     - `POST /api/locations` - Create new location
     - `PUT /api/locations/:id` - Update location
     - `DELETE /api/locations/:id` - Delete location
   - **Wishlist API**:
     - `GET /api/wishlist` - Get all wishlist items
     - `POST /api/wishlist` - Add to wishlist
     - `PUT /api/wishlist/:id` - Update wishlist item
     - `DELETE /api/wishlist/:id` - Delete wishlist item
     - `POST /api/wishlist/:id/acquire` - Move wishlist item to collection
   - **Tags API**:
     - `POST /api/tags` - Create a new tag
     - `DELETE /api/tags/:name` - Delete tag (removes from all cards)

3. **API Integrations**
   - **Scryfall API**: Fetches card metadata (colors, types, mana cost, images) using fuzzy name matching
   - **Pricing Strategy (Exor Games with Scryfall Backup)**:
     - **Primary**: Searches exorgames.com for card pricing
       - Extracts prices from HTML using regex pattern matching
       - Prices in CAD, converted to USD using approximate 0.73 conversion rate
       - 500ms delay between bulk requests to be respectful to their servers
     - **Fallback**: If Exor Games returns $0 or fails, automatically uses Scryfall pricing
       - Ensures every card has a price even if not available at Exor Games
       - Logs fallback usage to console for debugging
     - Returns `{cad, usd, source}` where source is 'Exor Games', 'Scryfall (backup)', or 'None (not found)'
   - **Image Caching System**:
     - Card images are downloaded from Scryfall and cached locally in `backend/cached-images/`
     - Images are stored as `.jpg` files named by Scryfall ID (e.g., `abc123.jpg`)
     - Caching happens automatically when:
       - Searching for cards via Scryfall
       - Bulk importing cards (online mode)
       - Updating card data with `fullData=true`
     - Cached images are served via `/api/images/:scryfallId` endpoint
     - Enables offline image viewing - once cached, images load without internet connection
     - Cache directory is excluded from Git via `.gitignore` (not shared between installations)

### Frontend Structure (`frontend/src/`)

React single-page application with all logic in `App.js`:

1. **State Management**
   - Uses React hooks (useState, useEffect, useMemo) for local state
   - No external state management library (Redux, etc.)

2. **Key Features**
   - Card autocomplete using Scryfall API (debounced at 2+ characters)
   - Real-time card search with Scryfall integration
   - **Filtering**: by search term, condition, set, color, type, special (tokens/foil), rarity, tags, location
     - Search includes card name, set, oracle text (optional), and tags
     - Special filter combines Token and Foil filters: All Cards, Tokens Only, Non-Tokens Only, Foil Only, Non-Foil Only
     - Rarity filter: All Rarities, Common (C), Uncommon (U), Rare (R), Mythic (M)
     - Location filter: Filter by storage location
   - **Sorting**: by name, price, quantity, total value, type, color
   - CRUD operations for cards
   - **Price updates** (individual and bulk):
     - Individual: Dollar sign icon on each card row
     - Bulk: "Update All Prices" button opens modal with options:
       - "Force Update Existing Cards" - Updates all cards even if they have data
       - "Update Full Card Data" - Fetches complete metadata (set, rarity, collector number, colors, types, mana cost, images)
   - Export to JSON/CSV (CSV now includes all 21 fields)
   - Collection statistics dashboard
   - **Hover Preview**: Hover over card names to see cached card image (works offline if image is cached)
   - **Auto-merge duplicates**: Prevents duplicate entries by auto-incrementing quantity
   - **Bulk Import**: Import multiple cards from .txt files (supports formats like "4 Lightning Bolt" and "Lightning Bolt")
   - **Offline Mode**: Import cards without internet connection (stores minimal data, can fetch details later when online)
   - **Deck Builder**: Create and manage decks from your collection (separate view)
   - **Wishlist**: Track cards you want to acquire with target prices and priority levels
   - **Storage Locations**: Track where cards are physically stored (binders, boxes, etc.)
   - **Bulk Operations**: Select multiple cards and update condition, location, or tags in bulk
   - **Print Proxies**: Print selected cards as proxies in 3x3 grid format for playtesting
   - **Similar Cards**: Find cards similar to ones in your collection (by type and color)
   - **Card Synergies**: Find cards that synergize with a specific card (tribal, keywords, mechanics)
   - **Commander Recommendations**: Get commander suggestions based on your collection's colors and themes
   - **Set Completion Tracker**: View progress toward completing each set in your collection

3. **UI Components**
   - Inline components (no separate component files)
   - Tailwind CSS with glassmorphism design (backdrop-blur)
   - Lucide-react icons (size 18 for most buttons, size 16 for table action buttons)
   - **Compact Button Design**: All buttons use `py-1` (reduced padding) for a streamlined appearance
   - **Toggle Buttons**: Update options (Force Update, Full Data) are toggle buttons instead of checkboxes
     - Active state: purple background with checkmark (✓)
     - Inactive state: semi-transparent white background
   - **9-Column Filter Grid**: Search, Condition, Set, Color, Type, Special, Rarity, Tags, Location
   - **Card Action Buttons** (in table Actions column):
     - Dollar sign (indigo): Update price for this card
     - Edit pencil (blue): Edit card details
     - Layers (purple): Find similar cards
     - Zap (yellow): Find card synergies
     - Trash (red): Delete card
   - **Header Buttons**:
     - Import, JSON, CSV: File operations
     - Update Prices: Opens modal with update options
     - Fetch Card Text: Update oracle text for all cards
     - Wishlist (pink): Toggle wishlist view
     - Deck Builder (purple): Toggle deck builder view
     - Commanders (amber): Open commander recommendations
     - Sets (teal): Open set completion tracker
     - Gear icon: Open locations & tags manager

### Data Flow

1. User enters card name → Autocomplete suggestions from Scryfall
2. User selects card → Full card data fetched from Scryfall (including price)
3. User adjusts quantity/condition → Saves to MongoDB
4. Cards displayed with filtering/sorting applied via useMemo
5. Price updates fetch latest data from Scryfall and update MongoDB

## Environment Configuration

**Backend** (`backend/.env`):
```
MONGODB_URI=mongodb+srv://... or mongodb://localhost:27017/mtg-tracker
PORT=5000
```

The project includes template configuration files:
- `.env.cloud` - MongoDB Atlas (cloud) configuration
- `.env.local` - Local MongoDB configuration

To switch between local and cloud MongoDB:
```bash
# Use local MongoDB (offline capable)
copy .env.local .env

# Use cloud MongoDB (requires internet)
copy .env.cloud .env
```

See `MONGODB_SETUP.md` for full installation and configuration instructions.

**Frontend**:
- API URL hardcoded: `http://localhost:5000/api` in `App.js`
- For production, update this to your backend URL

## Important Implementation Details

1. **Pricing with Fallback Strategy**:
   - **Primary (Exor Games)**: Scrapes HTML from `https://exorgames.com/a/search?type=product&q={cardName}`
     - Extracts price from embedded JSON using regex: `/"price":\s*(\d+)/`
     - Prices are in cents (CAD), converted to dollars and then to USD (~0.73 conversion)
   - **Fallback (Scryfall)**: If Exor Games returns $0 or fails, automatically fetches from Scryfall API
   - 500ms delay between bulk updates to avoid overloading servers
   - Price source is tracked in response: 'Exor Games', 'Scryfall (backup)', or 'None (not found)'

2. **Smart Price Updates (Skip Existing Data)**:
   - Price update endpoints (`/api/cards/:id/update-price` and `/api/cards/update-all-prices`) by default only update cards missing price or oracle text
   - Query parameters:
     - `?force=true` - Force update cards even if they have existing data
     - `?fullData=true` - Update complete card data (set, setCode, collectorNumber, rarity, colors, types, manaCost, scryfallId, imageUrl, oracleText, price)
   - **Skip Logic**:
     - Skip if: `!force && !fullData && card.price > 0 && card.oracleText`
     - This means `fullData=true` bypasses the skip check (cards will be updated even if they have existing data)
   - Without `fullData=true`: Only updates price and oracle text (if missing)
   - With `fullData=true`: Fetches and updates ALL card metadata from Scryfall, including set code, rarity, and collector number
   - **Image Caching**: When `fullData=true`, images are automatically downloaded and cached locally
   - Prevents unnecessary API calls and respects rate limits when updating large collections
   - Useful for filling in data for cards imported in offline mode without re-fetching data for complete cards

3. **Scryfall Integration**: Still used for autocomplete and card data (not pricing)
   - Autocomplete triggers at 2+ characters
   - Fetches complete card metadata including images, colors, types, mana cost

4. **Card Schema Pre-save Hook**: The `updatedAt` field is automatically updated on every save via Mongoose middleware

5. **Type Handling**: Card types from Scryfall are split by '—' and trimmed (e.g., "Creature — Human Wizard" → ["Creature"])

6. **Frontend Filtering**: All filtering and sorting happens client-side using useMemo for performance

7. **CORS**: Backend has CORS enabled for all origins (suitable for development)

8. **Database Connection**: MongoDB connection string should include database name or default to 'mtg-tracker'

9. **Currency Display**: Prices stored and displayed in USD (converted from Exor Games CAD pricing)

10. **Duplicate Card Handling (Auto-Merge)**:
   - When adding a card via `POST /api/cards`, the backend checks for existing cards with the same name, set, AND condition
   - If found, increments the existing card's quantity instead of creating a duplicate entry
   - Returns `{merged: true, message: "..."}` in response to indicate merge occurred
   - Frontend displays alert showing the new quantity
   - This means you can't have duplicate entries of the exact same card (name + set + condition)
   - You CAN have the same card name in different sets or different conditions

11. **Card Image Hover Preview**:
   - Hovering over a card name in the table displays the card image
   - Image positioned at center of screen using fixed positioning
   - Images are served from local cache (`/api/images/:scryfallId`) if cached, otherwise from Scryfall URL
   - **Offline Support**: Cached images display even without internet connection
   - Preview appears instantly on hover, disappears on mouse leave

12. **Bulk Import with Offline Support**:
   - Two endpoints: `/api/cards/bulk-import` (online with fallback) and `/api/cards/bulk-import-offline` (pure offline)
   - Parses multiple card formats: `4 Lightning Bolt`, `Lightning Bolt`, `1 Evolving Wilds (PLST) C18-245`
   - Strips set codes and collector numbers using regex: `/\s*\([A-Z0-9]+\)\s*[A-Z0-9\-]*$/i`
   - **Online mode**: Fetches full data from Scryfall + Exor Games pricing
   - **Offline mode**: Creates cards with minimal data (name, quantity, defaults for other fields)
   - Auto-merge applies in both modes (checks name + set + condition)
   - Frontend shows real-time progress with card-by-card status updates
   - Results categorized as: added, merged, offline, or failed

13. **MongoDB Local and Cloud Configuration**:
   - Supports both **local MongoDB** (`mongodb://localhost:27017/mtg-tracker`) and **MongoDB Atlas** (cloud)
   - Configuration files in `backend/`:
     - `.env` - Current active configuration
     - `.env.local` - Local MongoDB template
     - `.env.cloud` - Cloud MongoDB template
   - Switch between local/cloud by copying the desired .env file: `copy .env.local .env`
   - Local MongoDB enables offline use (except for Scryfall API calls during card import)
   - See `MONGODB_SETUP.md` for installation and switching instructions

14. **Project Sharing and Privacy (.gitignore)**:
   - `.gitignore` file ensures safe sharing without exposing personal data
   - **Excluded from Git** (never committed):
     - `.env` files (database credentials)
     - `backend/cached-images/` (your cached card images)
     - `node_modules/` (dependencies, can be reinstalled)
     - MongoDB data files
   - **Included in Git** (safe to share):
     - All source code
     - `.env.local` and `.env.cloud` templates (no credentials)
     - Documentation files
   - When sharing, recipients get a clean installation with:
     - Zero cards in collection
     - No cached images
     - No database credentials
     - They create their own `.env` and database
   - See `INSTALL.md` "Sharing with Friends" section for detailed instructions

## Common Development Workflows

**Adding a card:**
- Type name in autocomplete field (uses Scryfall autocomplete)
- Select from dropdown or click "Search Scryfall"
- Card data fetched from Scryfall, pricing from Exor Games
- Adjust quantity, condition as needed
- Prices auto-populate from Exor Games (in USD, converted from CAD)

**Updating prices:**
- Individual: Click dollar sign icon on card row (fetches from Exor Games with Scryfall fallback)
- Bulk: Click "Update All Prices" button (takes time due to 500ms rate limiting per card)
  - By default, only updates cards missing price or oracle text data
  - Click "Force Update Existing Cards" toggle button (purple = active) to update ALL cards regardless of existing data
  - Click "Update Full Card Data" toggle button (purple = active) to fetch and update complete card metadata:
    - Set name, set code, collector number, rarity
    - Colors, types, mana cost
    - Card images (automatically cached locally for offline use)
    - Oracle text, price
  - Without "Update Full Card Data": Only updates price and oracle text (if missing)
  - **Note**: `fullData=true` automatically bypasses skip logic, so cards will be updated even if they have existing data
  - Shows detailed results: cards updated, skipped, and total count

**Bulk importing cards:**
- Prepare a .txt file with card names (one per line)
  - Format: `4 Lightning Bolt` (with quantity) or `Lightning Bolt` (defaults to 1)
  - Set codes are automatically stripped: `1 Evolving Wilds (PLST) C18-245` becomes `Evolving Wilds`
- Click "Import" button and select your .txt file
- Online mode (default): Fetches full card data from Scryfall (slower, complete data)
- Offline mode (checkbox): Imports with minimal data only (faster, works offline)
  - Cards imported offline have "Unknown" set, $0 price, no colors/types/mana cost
  - Use "Update All Prices" later when online to fetch complete data
- Real-time progress bar shows import status

**Filtering and searching:**
- **Search bar**: Searches card name, set name, oracle text (if enabled), and tags
  - Toggle "Include card text in search" checkbox to enable/disable oracle text search
- **8 Filter dropdowns**:
  1. Condition: All Conditions, NM, LP, MP, HP, DMG
  2. Set: All Sets, [dynamically populated from your collection]
  3. Color: All Colors, White, Blue, Black, Red, Green, Colorless
  4. Type: All Types, [dynamically populated from your collection]
  5. Special: All Cards, Tokens Only, Non-Tokens Only, Foil Only, Non-Foil Only
  6. Rarity: All Rarities, Common (C), Uncommon (U), Rare (R), Mythic (M)
  7. Tags: All Tags, [dynamically populated from your collection]
- All filters work together (AND logic)
- Filters reset pagination to page 1 automatically

**Exporting collection:**
- JSON format: preserves all MongoDB fields including IDs
- CSV format: includes calculated total value column

**Using offline mode:**
- Enable "Offline Mode" checkbox in the header
- Bulk import will work without internet connection
- Cards added with name and quantity only
- All other fields (set, price, colors, types, mana cost, image) set to defaults
- When back online, use "Update All Prices" with "Update Full Card Data" enabled to fetch complete card details
- **Image Caching for Offline Use**:
  - Card images are automatically cached locally when added/updated while online
  - Once cached, images display even without internet connection
  - Cached images stored in `backend/cached-images/`
  - To build image cache: Use "Update Full Card Data" when online (downloads and caches all card images)

## Recent Updates and Changes

### Image Caching System (January 2026)
- **Backend**: Card images now download from Scryfall and cache locally in `backend/cached-images/`
- **Endpoint**: New `GET /api/images/:scryfallId` serves cached images
- **Offline Support**: Images load from local cache even without internet
- **Auto-caching**: Images cached during card search, bulk import, and full data updates
- **Privacy**: Cached images excluded from Git via `.gitignore`

### UI/UX Improvements (January 2026)
- **Compact Buttons**: All buttons reduced from `py-2`/`py-3` to `py-1` for streamlined appearance
- **Icon Sizes**: Reduced to 18px (main buttons) and 16px (table actions) for better proportion
- **Toggle Buttons**: "Force Update" and "Update Full Card Data" changed from checkboxes to toggle buttons
  - Active state: purple background with checkmark (✓)
  - Inactive state: semi-transparent white background

### Filter Enhancements (January 2026)
- **Combined Special Filter**: Merged Token and Foil filters into single dropdown
  - Options: All Cards, Tokens Only, Non-Tokens Only, Foil Only, Non-Foil Only
- **New Rarity Filter**: Filter by Common (C), Uncommon (U), Rare (R), Mythic (M)
- **Grid Layout**: Expanded from 7 to 8 columns to accommodate new filters
- **Filter Count**: Now 8 filters total: Search, Condition, Set, Color, Type, Special, Rarity, Tags

### Bug Fixes (January 2026)
- **Update Full Card Data Fix**: Fixed skip logic so `fullData=true` properly bypasses skip check
  - Previously: Cards with existing data were skipped even with `fullData=true`
  - Now: Skip only if `!force && !fullData && card.price > 0 && card.oracleText`
  - Result: Set code, rarity, and collector number now update correctly with "Update Full Card Data"

### Project Sharing (January 2026)
- **`.gitignore` Added**: Ensures safe sharing without exposing personal data
  - Excludes: `.env`, `cached-images/`, `node_modules/`, MongoDB data
  - Includes: Source code, templates, documentation
- **Documentation**: Updated `INSTALL.md` with "Sharing with Friends" section
- **Privacy**: Recipients get clean installation with zero cards and no credentials

### Wishlist Feature (January 2026)
- **New View**: Toggle between Collection, Wishlist, and Deck Builder views
- **WishlistItem Schema**: Stores target price, current price, priority (low/medium/high), notes
- **Deal Detection**: Cards highlight green when current price is at or below target price
- **Acquire**: Move cards from wishlist directly to collection with one click
- **Priority Filter**: Filter wishlist by priority level

### Storage Locations (January 2026)
- **Location Field**: Cards can be assigned to storage locations (binders, boxes, etc.)
- **Location Schema**: Manage location names and descriptions
- **Location Manager**: Gear icon opens modal to create/edit/delete locations
- **Location Filter**: Filter collection by storage location
- **Location Column**: Shows in card table

### Bulk Operations (January 2026)
- **Checkbox Selection**: Select individual cards or "Select All" on current page
- **Persistent Selection**: Selection persists across pagination
- **Floating Action Bar**: Appears when cards are selected, shows count
- **Bulk Actions**:
  - Update Condition (NM, LP, MP, HP, DMG)
  - Update Location
  - Add Tags
  - Remove Tags
  - Delete (with confirmation)
- **Print Proxies**: Print selected cards as 3x3 grid proxies

### Tags Management (January 2026)
- **Tags Tab**: Added to Location Manager modal (gear icon)
- **Create Tags**: Add new tags from the manager
- **Delete Tags**: Remove tags (automatically removes from all cards)
- **Tag Filter**: Filter collection by tags
- **Bulk Tag Operations**: Add/remove tags from multiple cards at once

### Similar Cards Feature (January 2026)
- **Similar Button**: Purple layers icon in card actions column
- **Scryfall Search**: Finds cards matching same type and color identity
- **EDHREC Sorting**: Results sorted by EDHREC popularity
- **Add Options**: Add similar cards to Collection or Wishlist
- **Double-faced Support**: Handles cards with multiple faces

### Card Synergies Feature (January 2026)
- **Synergies Button**: Yellow zap icon in card actions column
- **Three Categories** (tabs):
  - **Tribal**: Cards that synergize with creature types
  - **Keywords**: Cards sharing keywords (flying, lifelink, etc.)
  - **Mechanics**: Cards with related mechanics (tokens, counters, sacrifice, etc.)
- **Smart Detection**: Parses oracle text to identify synergy patterns
- **Color Identity**: Only shows cards within color identity
- **Add Options**: Add synergy cards to Collection or Wishlist

### Commander Recommendations (January 2026)
- **Commanders Button**: Amber crown icon in header
- **Collection Analysis**: Analyzes your cards' colors and themes
- **Theme Detection**: Detects themes like tokens, graveyard, counters, lifegain, etc.
- **Color Filter**: Auto-detect from collection or manually select colors
- **EDHREC Sorting**: Results sorted by popularity
- **Add to Collection**: Adds commander with "commander" tag

### Set Completion Tracker (January 2026)
- **Sets Button**: Teal bar chart icon in header
- **Progress Bars**: Shows completion percentage for each set
- **Color Coding**: Red (<25%) → Yellow (25-49%) → Blue (50-74%) → Teal (75-99%) → Green (100%)
- **Set Info**: Shows set icon, name, code, and type
- **Statistics**: Unique cards owned vs total in set, plus total copies

### Deck Builder Enhancements (January 2026)
- **Power Level Estimator** (1-10 scale):
  - Analyzes fast mana, tutors, combo pieces, removal, powerhouses
  - Considers average CMC and deck value
  - Labels: Jank (1-2), Casual (3-4), Optimized (5-6), High Power (7-8), cEDH (9-10)
- **Salt Score**:
  - Calculates deck "saltiness" based on EDHREC community feedback
  - High salt (3 pts): Cyclonic Rift, Armageddon, Stasis, etc.
  - Medium salt (2 pts): Rhystic Study, Smothering Tithe, etc.
  - Low salt (1 pt): Sol Ring, Demonic Tutor, etc.
  - Shows list of salty cards in deck
  - Labels: Low Salt, Mild Salt, Pretty Salty, Maximum Salt

### Export Enhancements (January 2026)
- **CSV Export**: Now includes all 21 card fields:
  - Name, Set, Set Code, Collector Number, Rarity
  - Quantity, Condition, Price, Total Value
  - Colors, Types, Mana Cost, Tags, Location
  - Is Token, Is Foil, Scryfall ID, Image URL
  - Oracle Text, Created At, Updated At
- **Proper Escaping**: CSV fields with quotes are properly escaped
