# Linux Quick Start (1 Minute)

## Automatic Installation (Recommended)

```bash
# Navigate to project directory
cd /path/to/mtg-tracker

# Run the automated installer
chmod +x install-linux.sh
./install-linux.sh
```

**That's it!** The script will:
- ✅ Install Node.js 20.x
- ✅ Install MongoDB 7.0
- ✅ Install all project dependencies
- ✅ Configure environment files
- ✅ Start MongoDB service
- ✅ Offer to launch the app

**Supported distributions:** Ubuntu, Debian, Fedora, RHEL, CentOS, Arch, Manjaro

---

## Manual Installation (If Automated Script Fails)

<details>
<summary>Click to expand manual steps</summary>

### Prerequisites (One-Time Setup)

```bash
# 1. Install Node.js and npm
sudo apt update
sudo apt install nodejs npm -y
node --version  # Should be 18+

# 2. Install MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install mongodb-org -y

# 3. Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Install MTG Tracker

```bash
# Navigate to project directory
cd /path/to/mtg-tracker

# Install all dependencies
cd backend && npm install
cd ../frontend && npm install
cd .. && npm install

# Configure database (local MongoDB)
cd backend
cp .env.local .env
cd ..
```

</details>

## Run the Application

```bash
# Option 1: Cross-platform (recommended)
npm start

# Option 2: Shell script
chmod +x start.sh  # First time only
./start.sh
```

**Access:**
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

**Stop:** Press `Ctrl+C`

## Verify Setup

```bash
# Check backend
curl http://localhost:5000/api/cards

# Check MongoDB
sudo systemctl status mongod
```

## Troubleshooting

**MongoDB not running:**
```bash
sudo systemctl start mongod
```

**Port already in use:**
```bash
sudo lsof -i :5000  # Check what's using port 5000
sudo lsof -i :3000  # Check what's using port 3000
```

**Need more help?** See [LINUX_SETUP.md](./LINUX_SETUP.md) for detailed guide.

---

## Daily Use

```bash
cd /path/to/mtg-tracker
npm start  # That's it!
```
