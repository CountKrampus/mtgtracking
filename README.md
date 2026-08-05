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
- 🌐 Works offline with local MongoDB
- 👥 Multi-user support with roles (admin, editor, viewer)
- 🔐 Authentication and user management with password reset functionality
- 👑 Admin panel for system administration
- 🃏 Deck builder and management
- ❤️ Life counter for games
- 🛒 Wishlist functionality
- 📍 Location tracking for physical cards
- 📱 QR codes for easy location identification
- 📷 Camera OCR for quick card addition
- ⚡ Bulk operations for efficient management

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
- Database backups should be managed separately from the code repository

## License

ISC
