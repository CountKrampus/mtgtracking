@echo off
echo Starting MTG Tracker (Local/Offline Mode)...
echo.

REM Start MongoDB in a new window
echo Starting MongoDB...
start "MTG Tracker - MongoDB" cmd /k "mongod --dbpath ""D:\Card Tracker\mongodb-data"""

REM Wait for MongoDB to initialize
echo Waiting for MongoDB to start...
timeout /t 5 /nobreak >nul

REM Start backend in a new window
echo Starting Backend...
start "MTG Tracker - Backend" cmd /k "cd /d backend && npm run dev"

REM Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

REM Start frontend in a new window
echo Starting Frontend...
start "MTG Tracker - Frontend" cmd /k "cd /d frontend && npm start"

echo.
echo All services are starting in separate windows:
echo   - MongoDB: localhost:27017
echo   - Backend: http://localhost:5000
echo   - Frontend: http://localhost:3000
echo.
echo Keep all three windows open while using the app!
echo Close any window to stop that service.
echo.
pause
