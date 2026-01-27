@echo off
echo Stopping MTG Tracker services...
echo.

REM Kill Node.js processes (Backend and Frontend)
echo Stopping Backend and Frontend...
taskkill /F /IM node.exe >nul 2>&1

REM Kill MongoDB process
echo Stopping MongoDB...
taskkill /F /IM mongod.exe >nul 2>&1

echo.
echo All services stopped!
echo.
pause
