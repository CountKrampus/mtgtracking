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
- 💰 Automatic pricing from Exor Games (CAD) with Scryfall backup
- 📦 Bulk import from text files
- 🖼️ Offline card image caching
- 📊 Collection statistics and filtering
- 💾 Export to JSON/CSV
- 🌐 Works offline with local MongoDB

## Full Installation Guides

- **[INSTALL.md](./INSTALL.md)** - General installation (Windows/Mac/Linux)
- **[LINUX_SETUP.md](./LINUX_SETUP.md)** - Detailed Linux-specific walkthrough
- **[MONGODB_SETUP.md](./MONGODB_SETUP.md)** - Database configuration

## Tech Stack

- **Backend:** Node.js + Express + MongoDB
- **Frontend:** React + Tailwind CSS
- **APIs:** Scryfall (card data) + Exor Games (pricing)

## Documentation

- [INSTALL.md](./INSTALL.md) - Complete installation guide
- [CLAUDE.md](./CLAUDE.md) - Architecture and development guide
- [MONGODB_SETUP.md](./MONGODB_SETUP.md) - Database configuration

## Requirements

- Node.js 18+
- MongoDB 7.0+ (local) or MongoDB Atlas (cloud)
- Modern web browser

## License

ISC
