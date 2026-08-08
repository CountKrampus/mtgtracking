@echo off
echo Starting MTG Tracker - Backend, Frontend, and Discord Bot
echo.

REM Start backend in background
cd backend
start "MTG Tracker Backend" cmd /k "npm run dev"
cd ..

REM Small delay to ensure backend starts
timeout /t 2 /nobreak >nul

REM Start frontend in background
cd frontend
start "MTG Tracker Frontend" cmd /k "npm start"
cd ..

REM Start Discord bot (skips itself if discord-bot\.env doesn't exist yet,
REM so this script still works before the bot has been configured)
if exist discord-bot\.env (
  cd discord-bot
  start "MTG Tracker Discord Bot" cmd /k "npm run dev"
  cd ..
) else (
  echo Skipping Discord bot - discord-bot\.env not found. Copy discord-bot\.env.example to set it up.
)

REM Start Caddy
start "Caddy" cmd /k "caddy_windows_amd64.exe run"

echo All servers started.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo Site: https://mtgtracker.store
echo.
echo Press any key to exit...
pause >nul