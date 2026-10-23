# MTG Tracker

A full-stack web application for tracking your Magic: The Gathering card collection with pricing, filtering, and offline support.

## Quick Start

### Linux (Automated - 1 Minute)
```bash
chmod +x install-linux.sh
./install-linux.sh
```
Installs everything automatically and starts the app!

### Windows
```bash
start.bat
```

### Linux/Mac (After Installation)
```bash
./start.sh
```

### Cross-Platform (All Systems)
```bash
npm install  # First time only
npm start
```

## Features

- 🔍 Card search with Scryfall autocomplete
- 💰 Automatic pricing from Scryfall with MTGGoldfish backup
- 📦 Bulk import from text files
- 🖼️ Offline support with image and collection cache
- 📊 Collection statistics and filtering
- 💾 Export to JSON/CSV
- 📥 Import ManaBox, Moxfield, and Deckbox-style CSV exports with a preview
- ⚠️ Cross-deck copy allocation warnings and game matchup analytics
- 🛍️ Export missing set cards as a shopping-list CSV
- 🔄 Personal JSON backups with previewed, merge-only restore
- 🔔 Dashboard summary for active card price alerts
- 📦 Location inventory audits with saved counts and discrepancy review
- 🤝 Card lending records with due dates, return tracking, and available-copy checks
- 📈 Dashboard price movers based on saved daily card-price snapshots
- 🚀 First-run setup guide and configurable compact collection table
- 🌐 Works offline with local MongoDB
- 👥 Multi-user support with roles (admin, editor, viewer)
- 🔐 Authentication and user management with password reset functionality
- 👑 Admin panel for system administration
- 🃏 Deck builder and management
- ❤️ Life counter for games
- 🛒 Wishlist functionality
- 📍 Location tracking for physical cards
- 📱 QR codes for easy location identification
- 📷 Camera OCR with live capture-quality hints, image straightening, printing recognition, and batch rescans
- 📈 Daily collection value history broken down by set
- ⚡ Bulk operations for efficient management
- 💜 Optional community support with opt-in supporter recognition
- 🚩 Community content reports and a moderator review queue

## Full Installation Guides

- **[INSTALL.md](./INSTALL.md)** - General installation (Windows/Mac/Linux)
- **[LINUX_SETUP.md](./LINUX_SETUP.md)** - Detailed Linux-specific walkthrough
- **[MONGODB_SETUP.md](./MONGODB_SETUP.md)** - Database configuration

- backend/.env.example rename to .env

## Tech Stack

- **Backend:** Node.js + Express + MongoDB
- **Frontend:** React + Tailwind CSS
- **APIs:** Scryfall (card data and pricing) + MTGGoldfish (pricing fallback)

## Documentation

- [INSTALL.md](./INSTALL.md) - Complete installation guide
- [CLAUDE.md](./CLAUDE.md) - Architecture and development guide
- [MONGODB_SETUP.md](./MONGODB_SETUP.md) - Database configuration

## Requirements

- Node.js 18+
- MongoDB 7.0+ (local) or MongoDB Atlas (cloud)
- Modern web browser

## Notes

- The `dump/` folder containing database exports is ignored by Git to keep the repository lightweight
- Database backups should be managed separately from the code repository. For an individual collection backup, use **Settings → Data → Collection backup** to download a JSON file. Restoring previews the changes and only adds missing cards; it does not overwrite or delete existing entries.
- The Support page links to `https://buymeacoffee.com/creamkrampus` by default. Set `REACT_APP_SUPPORT_URL` in the frontend environment to override it, then rebuild/restart the frontend. Contributions are handled externally. To enable recognition, an admin creates the exact `Supporter` badge under **Admin → Community → Badges**, verifies contributions outside the app, and grants the badge under **Admin → User Management → Users**. Users must opt in on **Support the Site** before appearing on the public supporters list.

## License

ISC
