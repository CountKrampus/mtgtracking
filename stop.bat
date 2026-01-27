@echo off
echo Stopping MTG Tracker servers...

REM Kill all Node.js processes
taskkill /F /IM node.exe 2>nul

echo.
echo All servers stopped.
pause
