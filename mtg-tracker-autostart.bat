@echo off
REM ============================================================
REM  MTG Tracker - Auto-start on Windows boot
REM  Installs into a shortcut placed in the user's Startup folder.
REM  Skips starting components that are already running (MongoDB
REM  service, ports 5000/3000, Caddy) so it is safe on re-logins.
REM
REM  Components:
REM   - MongoDB service (database, local)
REM   - Backend  :5000 (node server.js)
REM   - Frontend :3000 (CRA dev server, for local dev sessions)
REM   - Caddy    :8080 (serves the PRODUCTION build from
REM     frontend\build and proxies /api/* to the backend. This is
REM     what the public face uses once router ports 80/443 are
REM     forwarded; Caddy reloads its config from Caddyfile.)
REM ============================================================

set "PROJECT_DIR=D:\Card Tracker\mtg-tracker"

REM --- MongoDB service ---
sc query MongoDB | find "RUNNING" >nul 2>&1
if errorlevel 1 (
    echo Starting MongoDB service...
    net start MongoDB >nul 2>&1
)

REM --- Caddy (production frontend + api proxy on :8080) ---
cd /d "%PROJECT_DIR%"
netstat -ano | findstr /R "LISTENING" | findstr ":443 " >nul 2>&1
if errorlevel 1 (
    echo Starting Caddy...
    start "MTG Tracker Caddy" /min cmd /c "caddy_windows_amd64.exe run --config Caddyfile > caddy-boot.log 2>&1"
) else (
    echo Caddy already running on port 443.
)

REM --- Backend (port 5000) ---
timeout /t 2 /nobreak >nul
netstat -ano | findstr /R "LISTENING" | findstr ":5000 " >nul 2>&1
if errorlevel 1 (
    echo Starting backend...
    cd /d "%PROJECT_DIR%\backend"
    start "MTG Tracker Backend" /min cmd /c "npm start > backend-boot.log 2>&1"
) else (
    echo Backend already running on port 5000.
)

REM --- Frontend (port 3000, local dev server) ---
timeout /t 2 /nobreak >nul
netstat -ano | findstr /R "LISTENING" | findstr ":3000 " >nul 2>&1
if errorlevel 1 (
    echo Starting frontend...
    cd /d "%PROJECT_DIR%\frontend"
    start "MTG Tracker Frontend" /min cmd /c "npm start > frontend-boot.log 2>&1"
) else (
    echo Frontend already running on port 3000.
)

REM --- Discord bot (no port: it's an outbound WebSocket client to Discord,
REM     so the netstat guard used above can't detect it. Guard on the process
REM     instead - wmic matches any running node whose command line contains
REM     "discord-bot\src". If wmic is unavailable the guard fails OPEN (the
REM     bot is (re)started), which is the same behaviour as the other
REM     components when their probe can't run.)
REM     Requires discord-bot\.env to be filled in (see .env.example):
REM       DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID,
REM       DISCORD_BOT_SERVICE_TOKEN (must match backend\.env), API_BASE_URL
REM     Needs MULTI_USER_ENABLED=true in backend\.env - linking is rejected
REM     in single-user mode.)
timeout /t 2 /nobreak >nul
wmic process where "name='node.exe'" get CommandLine 2>nul | findstr /I /C:"discord-bot\src" >nul 2>&1
if errorlevel 1 (
    echo Starting Discord bot...
    cd /d "%PROJECT_DIR%\discord-bot"
    REM Run npm directly rather than via "start": "start ... cmd /c" silently
    REM fails to launch this bot in some shells (verified - it writes no log
    REM and leaves no process, while the plain cmd /c chain runs fine). The
    REM window stays open for the bot's lifetime, which is fine for a boot
    REM script.
    cmd /c "npm start > discord-bot-boot.log 2>&1"
) else (
    echo Discord bot already running.
)

exit
