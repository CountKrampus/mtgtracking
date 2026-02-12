@echo off
echo Starting MTG Tracker - Backend and Frontend
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

echo Both servers started.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit...
pause >nul