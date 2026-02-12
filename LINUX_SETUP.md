# MTG Tracker - Linux Setup Guide

Complete step-by-step guide for setting up MTG Tracker on Linux.

## 🚀 Automated Installation (Recommended)

**Want to skip all the manual steps?** We have an automated installer!

```bash
cd /path/to/mtg-tracker
chmod +x install-linux.sh
./install-linux.sh
```

**What it does:**
- ✅ Detects your Linux distribution (Ubuntu, Debian, Fedora, Arch, etc.)
- ✅ Installs Node.js 20.x
- ✅ Installs MongoDB 7.0
- ✅ Installs all project dependencies
- ✅ Creates `.env` configuration file
- ✅ Starts MongoDB service
- ✅ Verifies everything is working
- ✅ Offers to launch the app immediately

**The entire process takes about 1-2 minutes!**

If the automated installer fails or you prefer manual installation, continue reading below.

---

## 📖 Manual Installation

## Prerequisites Installation

### Step 1: Install Node.js and npm

**Ubuntu/Debian:**
```bash
# Update package index
sudo apt update

# Install Node.js and npm (LTS version)
sudo apt install nodejs npm -y

# Verify installation
node --version  # Should be v18.x or higher
npm --version
```

**If you need a newer version:**
```bash
# Install Node.js 20.x LTS using NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y
```

**Fedora/RHEL/CentOS:**
```bash
# Fedora
sudo dnf install nodejs npm -y

# RHEL/CentOS with NodeSource
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install nodejs -y
```

**Arch Linux:**
```bash
sudo pacman -S nodejs npm
```

### Step 2: Install MongoDB (Choose One Option)

#### Option A: Local MongoDB (Recommended for Offline Use)

**Ubuntu/Debian:**
```bash
# Import MongoDB public GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update and install
sudo apt update
sudo apt install mongodb-org -y

# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod  # Auto-start on boot

# Verify it's running
sudo systemctl status mongod
```

**Fedora:**
```bash
# Create MongoDB repo file
sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo << EOF
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF

# Install MongoDB
sudo dnf install mongodb-org -y

# Start and enable service
sudo systemctl start mongod
sudo systemctl enable mongod
```

**Arch Linux:**
```bash
# Install from official repos or AUR
yay -S mongodb-bin  # or mongodb-community from AUR

# Start service
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

#### Option B: MongoDB Atlas (Cloud - No Installation)

Sign up for free at: https://www.mongodb.com/cloud/atlas/register
- No local installation required
- Requires internet connection
- 512MB free tier

### Step 3: Install Git (Optional)

```bash
# Ubuntu/Debian
sudo apt install git -y

# Fedora
sudo dnf install git -y

# Arch
sudo pacman -S git
```

## Installation Steps

### Step 1: Get the Project

**Option A: Clone with Git**
```bash
# Clone the repository
git clone <repository-url>
cd mtg-tracker
```

**Option B: Download and Extract**
```bash
# If you downloaded a ZIP file
unzip mtg-tracker.zip
cd mtg-tracker
```

**Option C: Transfer from Windows**
```bash
# If copying from Windows machine via network/USB
cp -r /path/to/mtg-tracker ~/mtg-tracker
cd ~/mtg-tracker
```

### Step 2: Install Backend Dependencies

```bash
cd backend
npm install
```

**Expected output:**
```
added 150 packages, and audited 151 packages in 15s
```

### Step 3: Configure Backend Environment

**For Local MongoDB:**
```bash
cp .env.local .env
```

The `.env` file will contain:
```env
MONGODB_URI=mongodb://localhost:27017/mtg-tracker
PORT=5000
```

**For MongoDB Atlas (Cloud):**
```bash
cp .env.cloud .env
```

Then edit `backend/.env` with your Atlas connection string:
```bash
nano .env  # or use vim, gedit, etc.
```

### Step 4: Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

**Expected output:**
```
added 1400+ packages, and audited 1450 packages in 45s
```

### Step 5: Install Root Dependencies (for cross-platform script)

```bash
cd ..  # Back to root directory
npm install
```

This installs the `concurrently` package for running both servers.

## Running the Application

You have three options:

### Option 1: Cross-Platform npm Script (Easiest)

```bash
# From project root
npm start
```

**What happens:**
- Both backend and frontend start simultaneously
- Backend: http://localhost:5000
- Frontend: http://localhost:3000
- Press Ctrl+C to stop both

**Console output:**
```
[0] > backend@1.0.0 dev
[0] > nodemon server.js
[1] > frontend@1.0.0 start
[1] > react-scripts start
```

### Option 2: Shell Script

```bash
# Make script executable (first time only)
chmod +x start.sh

# Run the script
./start.sh
```

**To stop:** Press Ctrl+C (stops both servers)

### Option 3: Manual (Two Terminals)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

## Verification

### 1. Check Backend is Running

Open a new terminal:
```bash
curl http://localhost:5000/api/cards
```

**Expected response:** `[]` (empty array)

### 2. Check Frontend is Running

Open your browser:
```
http://localhost:3000
```

You should see the MTG Tracker interface.

### 3. Check MongoDB Connection

Look at the backend terminal output:

**Success:**
```
Server is running on port 5000
MongoDB connected successfully
```

**Failure:**
```
MongoDB connection error: connect ECONNREFUSED 127.0.0.1:27017
```

## Troubleshooting

### MongoDB Not Running

```bash
# Check status
sudo systemctl status mongod

# Start if stopped
sudo systemctl start mongod

# Check logs
sudo journalctl -u mongod -n 50
```

### Port 5000 Already in Use

```bash
# Find what's using the port
sudo lsof -i :5000

# Kill the process (if needed)
sudo kill -9 <PID>

# Or change the port in backend/.env
echo "PORT=5001" >> backend/.env
```

### Port 3000 Already in Use

The frontend will ask if you want to use a different port (usually 3001).

### Permission Denied on start.sh

```bash
# Make executable
chmod +x start.sh
```

### npm Install Fails

```bash
# Clear npm cache
npm cache clean --force

# Try again
npm install
```

### MongoDB Connection Issues

**Local MongoDB:**
```bash
# Verify MongoDB is running
mongosh  # MongoDB shell

# In mongosh:
show dbs
exit
```

**Cloud MongoDB Atlas:**
- Check internet connection
- Verify connection string in `backend/.env`
- Whitelist your IP in Atlas: Network Access → Add IP Address → Allow Access from Anywhere (for testing)

## Firewall Configuration (if needed)

If you have a firewall enabled:

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 5000/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 27017/tcp  # For MongoDB

# Fedora/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=27017/tcp
sudo firewall-cmd --reload
```

## Running in Background (Optional)

To keep the app running after closing the terminal:

### Using systemd (Recommended for Production)

Create service files:

**Backend Service:**
```bash
sudo nano /etc/systemd/system/mtg-backend.service
```

Content:
```ini
[Unit]
Description=MTG Tracker Backend
After=mongod.service

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username/mtg-tracker/backend
ExecStart=/usr/bin/npm run dev
Restart=always

[Install]
WantedBy=multi-user.target
```

**Frontend Service:**
```bash
sudo nano /etc/systemd/system/mtg-frontend.service
```

Content:
```ini
[Unit]
Description=MTG Tracker Frontend
After=mtg-backend.service

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username/mtg-tracker/frontend
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable mtg-backend mtg-frontend
sudo systemctl start mtg-backend mtg-frontend

# Check status
sudo systemctl status mtg-backend
sudo systemctl status mtg-frontend
```

### Using tmux or screen (Quick Method)

**With tmux:**
```bash
# Install tmux
sudo apt install tmux -y  # Ubuntu/Debian

# Start tmux session
tmux new -s mtg

# Run the app
npm start

# Detach: Press Ctrl+B, then D
# Reattach later: tmux attach -t mtg
```

**With screen:**
```bash
# Install screen
sudo apt install screen -y

# Start screen session
screen -S mtg

# Run the app
npm start

# Detach: Press Ctrl+A, then D
# Reattach later: screen -r mtg
```

## File Permissions

Ensure correct ownership:
```bash
# Make yourself the owner
sudo chown -R $USER:$USER ~/mtg-tracker

# Set proper permissions
chmod -R 755 ~/mtg-tracker
```

## Next Steps

1. **Add your first card:**
   - Open http://localhost:3000
   - Type a card name in the search field
   - Select from autocomplete

2. **Bulk import cards:**
   - Create a text file with card names
   - Click "Import" button
   - Select your file

3. **Update prices:**
   - Click "Update All Prices" button

4. **Enable offline mode:**
   - Check "Offline Mode" in header
   - Import cards without internet

## Accessing from Other Devices on Network

To access from other computers on your local network:

```bash
# Find your local IP
ip addr show | grep "inet " | grep -v 127.0.0.1

# Example output: 192.168.1.100
```

**Update frontend API URL:**
```bash
nano frontend/src/App.js
```

Change:
```javascript
const API_URL = 'http://localhost:5000/api';
```

To:
```javascript
const API_URL = 'http://192.168.1.100:5000/api';
```

Then rebuild frontend:
```bash
cd frontend
npm start
```

Access from other devices: `http://192.168.1.100:3000`

## Performance Tips

**Increase Node.js memory limit (for large collections):**
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm start
```

**Install build tools (if compilation errors occur):**
```bash
# Ubuntu/Debian
sudo apt install build-essential -y

# Fedora
sudo dnf groupinstall "Development Tools" -y
```

## Additional Resources

- MongoDB Linux Install: https://www.mongodb.com/docs/manual/administration/install-on-linux/
- Node.js Linux Install: https://nodejs.org/en/download/package-manager
- Project Documentation: See [INSTALL.md](./INSTALL.md) and [CLAUDE.md](./CLAUDE.md)

## Quick Reference Commands

```bash
# Start app (cross-platform)
npm start

# Start app (shell script)
./start.sh

# Check MongoDB status
sudo systemctl status mongod

# View backend logs
cd backend && npm run dev

# View frontend logs
cd frontend && npm start

# Stop all
Ctrl+C

# Update packages
cd backend && npm update
cd ../frontend && npm update
```

---

Need help? Check [INSTALL.md](./INSTALL.md) for general troubleshooting or [MONGODB_SETUP.md](./MONGODB_SETUP.md) for database-specific issues.
