@echo off
echo Starting MTG Tracker...
echo.

REM Start backend in a new window
echo Starting Backend...
start "MTG Tracker - Backend" cmd /k "cd /d backend && npm run dev"

REM Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

REM Start frontend in a new window
echo Starting Frontend...
start "MTG Tracker - Frontend" cmd /k "cd /d frontend && npm start"

echo.
echo Both servers are starting in separate windows.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
pause
