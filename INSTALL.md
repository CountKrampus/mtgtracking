# MTG Tracker - Installation Guide

Complete installation guide for the MTG Tracker application.

## Prerequisites

Before installing the application, you need to install the following software:

### 1. Node.js and npm

**Download:** https://nodejs.org/

- **Recommended:** LTS (Long Term Support) version 18.x or higher
- **Installer:** Windows Installer (.msi) - 64-bit
- **Includes:** npm (Node Package Manager) is included with Node.js

**Verify Installation:**
```bash
node --version
npm --version
```

### 2. MongoDB (Choose One)

#### Option A: Local MongoDB (Offline Capable)

**Download:** https://www.mongodb.com/try/download/community

- **Version:** Latest Community Edition (7.0+)
- **Platform:** Windows x64
- **Package:** MSI Installer

**Installation Steps:**
1. Run the downloaded `.msi` file
2. Choose "Complete" installation
3. **IMPORTANT:** Check "Install MongoDB as a Service" (auto-starts on boot)
4. **OPTIONAL:** Check "Install MongoDB Compass" (GUI database viewer)

**Verify Installation:**
```bash
mongod --version
```

**Start MongoDB Service:**
```bash
net start MongoDB
```

See [MONGODB_SETUP.md](./MONGODB_SETUP.md) for detailed MongoDB configuration and switching between local/cloud storage.

#### Option B: MongoDB Atlas (Cloud)

**Free Tier:** https://www.mongodb.com/cloud/atlas/register

- No local installation required
- Requires internet connection
- 512MB free tier available
- The project includes pre-configured cloud connection settings

### 3. Git (Optional, for cloning)

**Download:** https://git-scm.com/download/win

- Required if you want to clone the repository
- Otherwise, download the project as a ZIP file

## Installation Steps

### Step 1: Get the Project Files

**Option A: Clone with Git**
```bash
git clone <repository-url>
cd mtg-tracker
```

**Option B: Download ZIP**
- Download and extract the project ZIP file
- Navigate to the extracted folder

### Step 2: Install Backend Dependencies

```bash
cd backend
npm install
```

**Packages Installed:**
- `express` (^4.18.2) - Web server framework
  - https://expressjs.com/
- `mongoose` (^8.0.0) - MongoDB object modeling
  - https://mongoosejs.com/
- `cors` (^2.8.5) - Cross-Origin Resource Sharing
  - https://github.com/expressjs/cors
- `axios` (^1.6.0) - HTTP client for API requests
  - https://axios-http.com/
- `dotenv` (^16.3.1) - Environment variable management
  - https://github.com/motdotla/dotenv

**Dev Dependencies:**
- `nodemon` (^3.0.1) - Auto-restart server on file changes
  - https://nodemon.io/

### Step 3: Configure Backend Environment

**For Local MongoDB (Offline):**
```bash
copy .env.local .env
```

**For MongoDB Atlas (Cloud):**
```bash
copy .env.cloud .env
```

**Manual Configuration:**

Edit `backend/.env`:
```env
# Local MongoDB (offline)
MONGODB_URI=mongodb://localhost:27017/mtg-tracker
PORT=5000

# OR Cloud MongoDB (Atlas)
# MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>
# PORT=5000
```

### Step 4: Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

**Packages Installed:**
- `react` (^18.2.0) - UI library
  - https://react.dev/
- `react-dom` (^18.2.0) - React DOM rendering
- `react-scripts` (5.0.1) - Create React App build scripts
  - https://create-react-app.dev/
- `axios` (^1.6.0) - HTTP client
  - https://axios-http.com/
- `lucide-react` (^0.263.1) - Icon library
  - https://lucide.dev/
- `tesseract.js` (^5.1.0) - OCR library (for future features)
  - https://tesseract.projectnaptha.com/

**Dev Dependencies:**
- `tailwindcss` (^3.3.0) - Utility-first CSS framework
  - https://tailwindcss.com/
- `autoprefixer` (^10.4.16) - PostCSS plugin for vendor prefixes
- `postcss` (^8.4.31) - CSS transformation tool

## Running the Application

### Option 1: Cross-Platform npm Script (Recommended)

**First, install the root dependencies:**
```bash
npm install
```

**Then start both servers with one command:**
```bash
npm start
```
This starts both backend (port 5000) and frontend (port 3000) simultaneously.

### Option 2: Platform-Specific Scripts

**Windows (Batch File):**
```bash
start.bat
```
Opens two command windows for backend and frontend.

**Linux/Mac (Shell Script):**
```bash
chmod +x start.sh  # First time only - make script executable
./start.sh
```
Runs both servers in the terminal. Press Ctrl+C to stop both servers.

### Option 3: Start Both Servers Manually

**Backend (Terminal 1):**
```bash
cd backend
npm start
# Or for development with auto-restart:
npm run dev
```
Backend runs on: http://localhost:5000

**Frontend (Terminal 2):**
```bash
cd frontend
npm start
```
Frontend runs on: http://localhost:3000

## Verifying Installation

### 1. Check Backend

Open your browser or use curl:
```bash
curl http://localhost:5000/api/cards
```
Should return: `[]` (empty array) or your existing cards

### 2. Check Frontend

Open browser: http://localhost:3000

You should see the MTG Tracker interface with:
- Search/autocomplete field
- Card list table
- Filter/sort options
- Statistics panel

### 3. Test Database Connection

Check the backend terminal output:
- **Success:** `MongoDB connected successfully`
- **Local:** Connection to `localhost:27017`
- **Cloud:** Connection to MongoDB Atlas cluster name

## Troubleshooting

### "Cannot find module" errors
```bash
# In the directory with the error:
npm install
```

### Backend won't start
**Error:** `MongoDB connection error: connect ECONNREFUSED`
- MongoDB service is not running
- **Fix:** `net start MongoDB`
- Or switch to cloud: `copy .env.cloud .env`

**Error:** `Port 5000 is already in use`
- Another process is using port 5000
- **Fix:** Change `PORT=5000` to `PORT=5001` in `backend/.env`
- Update frontend API URL in `frontend/src/App.js` (line ~10)

### Frontend won't start
**Error:** `Port 3000 is already in use`
- Press `Y` when prompted to use a different port
- Or stop other processes using port 3000

### MongoDB Atlas connection issues
- Check internet connection
- Verify connection string in `backend/.env`
- Check if IP address is whitelisted in Atlas (Network Access settings)
- **Fallback:** Switch to local MongoDB: `copy .env.local .env`

### Missing packages
```bash
# Install all backend dependencies
cd backend
npm install

# Install all frontend dependencies
cd ../frontend
npm install
```

# Install VSCode
``` https://code.visualstudio.com ```

## Next Steps

After successful installation:

1. **Start adding cards**: Use the search field to find cards via Scryfall API
2. **Import bulk cards**: Use the Import button with a .txt file of card names
3. **Update prices**: Use "Update All Prices" to fetch current pricing from Exor Games
4. **Export collection**: Download your collection as JSON or CSV

## Sharing with Friends

Want to share this app with a friend? The project includes a `.gitignore` file that ensures they get a **clean, empty installation** without your data:

### What They WON'T Get (Automatically Excluded):
- ❌ Your card collection (stored in MongoDB)
- ❌ Your `.env` file (database credentials)
- ❌ Your cached card images
- ❌ node_modules folders

### What They WILL Get:
- ✅ All source code
- ✅ Configuration templates (`.env.local`, `.env.cloud`)
- ✅ Documentation (this file, CLAUDE.md, etc.)
- ✅ A fresh start with zero cards

### How to Share:

**Option 1: Via Git/GitHub (Recommended)**
```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit"

# Push to GitHub and share the repository link
# Your friend clones it and follows INSTALL.md
```

**Option 2: ZIP File**
1. Delete `backend/.env` (if it exists)
2. Delete `backend/cached-images/` folder (if it exists)
3. Delete all `node_modules/` folders
4. ZIP the entire project folder
5. Share the ZIP file

Your friend then follows the installation steps in this document to set up their own database and start fresh!

### Image Caching Feature

The app automatically caches card images locally for offline use:
- **First time**: Images download from Scryfall when you add cards
- **Stored in**: `backend/cached-images/` (excluded from sharing)
- **Offline mode**: Cached images load even without internet
- **Your friend**: Will build their own image cache as they add cards

## Additional Documentation

- [MONGODB_SETUP.md](./MONGODB_SETUP.md) - Detailed MongoDB configuration and offline mode
- [CLAUDE.md](./CLAUDE.md) - Project architecture and development guide
- [README.md](./README.md) - Project overview (if exists)

## Package Documentation Links

### Core Technologies
- **Node.js:** https://nodejs.org/docs/
- **React:** https://react.dev/learn
- **MongoDB:** https://www.mongodb.com/docs/
- **Express:** https://expressjs.com/en/guide/routing.html

### Backend Packages
- **Mongoose:** https://mongoosejs.com/docs/guide.html
- **Axios:** https://axios-http.com/docs/intro
- **CORS:** https://github.com/expressjs/cors#readme
- **dotenv:** https://github.com/motdotla/dotenv#readme
- **Nodemon:** https://github.com/remy/nodemon#readme

### Frontend Packages
- **Create React App:** https://create-react-app.dev/docs/getting-started
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Lucide Icons:** https://lucide.dev/guide/packages/lucide-react
- **Tesseract.js:** https://tesseract.projectnaptha.com/

### APIs Used
- **Scryfall API:** https://scryfall.com/docs/api (card data, images, autocomplete)
- **Exor Games:** https://exorgames.com/ (Canadian pricing via web scraping)

## System Requirements

### Minimum Requirements
- **OS:** Windows 10/11, macOS 10.15+, Linux (Ubuntu 20.04+)
- **RAM:** 4GB
- **Disk Space:** 500MB (plus space for MongoDB data)
- **Node.js:** 18.x or higher
- **MongoDB:** 7.0+ (if using local)

### Recommended
- **RAM:** 8GB+
- **Internet:** Required for card data and pricing (unless using offline mode)
- **Browser:** Latest Chrome, Firefox, Safari, or Edge
