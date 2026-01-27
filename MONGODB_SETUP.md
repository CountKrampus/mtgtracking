# MongoDB Setup Guide

This project supports both **local MongoDB** (offline) and **MongoDB Atlas** (cloud) storage.

## Current Configuration

- `.env` - Currently points to MongoDB Atlas (cloud)
- `.env.cloud` - MongoDB Atlas configuration (requires internet)
- `.env.local` - Local MongoDB configuration (offline capable)

## Installing Local MongoDB

### Windows Installation

1. **Download MongoDB Community Edition**
   - Visit: https://www.mongodb.com/try/download/community
   - Select: Windows x64
   - Version: Latest (7.0+)
   - Package: MSI

2. **Run the Installer**
   - Run the downloaded `.msi` file
   - Choose "Complete" installation
   - **Important**: Check "Install MongoDB as a Service" (runs automatically on startup)
   - **Important**: Check "Install MongoDB Compass" (optional GUI tool)

3. **Verify Installation**
   ```bash
   mongod --version
   ```

4. **Start MongoDB Service** (if not auto-started)
   ```bash
   net start MongoDB
   ```

## Switching Between Local and Cloud

### Option 1: Copy .env Files (Recommended)

**To use LOCAL storage** (offline):
```bash
cd backend
copy .env.local .env
```

**To use CLOUD storage** (MongoDB Atlas):
```bash
cd backend
copy .env.cloud .env
```

Then restart your backend server.

### Option 2: Manual Edit

Edit `backend/.env` and change the `MONGODB_URI` line:

**For local:**
```
MONGODB_URI=mongodb://localhost:27017/mtg-tracker
```

**For cloud:**
```
MONGODB_URI=
```

## Important Notes

### What Works Offline (Local MongoDB)
- ✅ View existing cards in collection
- ✅ Edit quantities/conditions
- ✅ Delete cards
- ✅ Filter and sort collection
- ✅ Export to JSON/CSV
- ✅ Add new cards (offline mode)
- ❌ Update prices (requires Exor Games/Scryfall API)
- ✅ Bulk import (offline mode)
- ❌ Card images won't load (hosted on Scryfall)

### What Requires Internet (Both Local and Cloud)
- Scryfall API (card data, autocomplete)
- Exor Games (pricing)
- Card images (Scryfall URLs)

### Syncing Between Local and Cloud

**Export from Cloud:**
```bash
# Make sure .env points to cloud
cd backend
node -e "require('dotenv').config(); const mongoose = require('mongoose'); /* export script */"
```

Or use the web UI: http://localhost:3000 → Export → JSON

**Import to Local:**
- Use the Bulk Import feature with your exported data
- Or manually add cards through the UI

## Checking Which Database You're Using

Look at your terminal when starting the backend:
- Local: `MongoDB connected successfully` + connection to `localhost:27017`
- Cloud: `MongoDB connected successfully` + connection to `mtgcards.hbqvogq.mongodb.net`

## Troubleshooting

**"MongoDB connection error: connect ECONNREFUSED"**
- Local MongoDB service is not running
- Run: `net start MongoDB`

**"MongooseServerSelectionError" with cloud**
- No internet connection
- Switch to local: `copy .env.local .env`

**Data not showing up**
- You switched databases (local and cloud are separate)
- Each database stores its own data independently

