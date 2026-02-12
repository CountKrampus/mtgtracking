@echo off
title MTG Tracker Server Manager
color 0A

:menu
cls
echo.
echo =====================================================
echo        MTG Tracker Server Manager
echo =====================================================
echo.
echo 1. Install/Setup Application
echo 2. Start Server
echo 3. Stop Server
echo 4. Restart Server
echo 5. Update from GitHub
echo 6. Exit
echo.
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" goto install
if "%choice%"=="2" goto start_server
if "%choice%"=="3" goto stop_server
if "%choice%"=="4" goto restart_server
if "%choice%"=="5" goto update_from_github
if "%choice%"=="6" goto exit_program

echo.
echo Invalid choice. Please try again.
pause
goto menu

:update_from_github
cls
echo.
echo =====================================================
echo         Updating MTG Tracker from GitHub
echo =====================================================
echo.

REM Check if git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Git is not installed or not in PATH.
    echo Please install Git from https://git-scm.com/
    pause
    goto menu
)

REM Check if this is a git repository
if not exist ".git" (
    echo Error: This directory is not a Git repository.
    echo Would you like to clone the repository? [Y/N]
    set /p clone_choice="Choice: "
    if /i "%clone_choice%"=="Y" (
        goto clone_repository
    ) else (
        goto menu
    )
)

echo Pulling latest changes from GitHub...
git fetch
git pull origin main

if %errorlevel% eq 0 (
    echo.
    echo Update completed successfully!
    echo.
    echo Would you like to reinstall dependencies? [Y/N]
    set /p reinstall_choice="Choice: "
    if /i "%reinstall_choice%"=="Y" (
        goto install
    )
) else (
    echo.
    echo Update failed. Check for conflicts or network issues.
)

pause
goto menu

:clone_repository
cls
echo.
echo =====================================================
echo           Cloning MTG Tracker Repository
echo =====================================================
echo.

set /p repo_url="Enter repository URL (press Enter for default): "
if "%repo_url%"=="" set repo_url="https://github.com/CountKrampus/mtgtracking.git"

echo Cloning repository from: %repo_url%
git clone %repo_url% .

if %errorlevel% eq 0 (
    echo.
    echo Repository cloned successfully!
    echo.
    echo Would you like to install dependencies? [Y/N]
    set /p deps_choice="Choice: "
    if /i "%deps_choice%"=="Y" (
        goto install
    )
) else (
    echo.
    echo Clone failed. Check the repository URL and network connection.
)

pause
goto menu

:install
cls
echo.
echo =====================================================
echo          Installing MTG Tracker Dependencies
echo =====================================================
echo.

echo Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js not found. Downloading and installing Node.js (LTS version)...
    echo Please wait...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.17.1/node-v18.17.1-x64.msi' -OutFile 'nodejs.msi'"
    msiexec /i nodejs.msi /quiet
    del nodejs.msi
    echo Node.js installed successfully.
    echo Please restart this script to continue.
    pause
    goto menu
) else (
    echo Node.js is installed.
)

echo Checking npm installation...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo npm not found. Please install Node.js which includes npm.
    pause
    goto menu
) else (
    echo npm is installed.
)

echo Checking MongoDB installation...
mongod --version >nul 2>&1
if %errorlevel% neq 0 (
    echo MongoDB not found. Downloading and installing MongoDB Community Server...
    echo Please wait...
    powershell -Command "Invoke-WebRequest -Uri 'https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.5.msi' -OutFile 'mongodb.msi'"
    msiexec /i mongodb.msi /quiet
    del mongodb.msi
    echo MongoDB installed successfully.
    echo Please restart this script to continue.
    pause
    goto menu
) else (
    echo MongoDB is installed.
)

echo Installing backend dependencies...
if exist "backend" (
    cd backend
    npm install
    if %errorlevel% neq 0 (
        echo Failed to install backend dependencies.
        pause
        cd ..
        goto menu
    )
    echo Backend dependencies installed successfully.
    cd ..
) else (
    echo Backend directory not found. Skipping backend installation.
)

echo Installing frontend dependencies...
if exist "frontend" (
    cd frontend
    npm install
    if %errorlevel% neq 0 (
        echo Failed to install frontend dependencies.
        pause
        cd ..
        goto menu
    )
    echo Frontend dependencies installed successfully.
    cd ..
) else (
    echo Frontend directory not found. Skipping frontend installation.
)

echo.
echo Installation complete!
pause
goto menu

:start_server
cls
echo.
echo =====================================================
echo            Starting MTG Tracker
echo =====================================================
echo.

echo Starting MongoDB service...
net start MongoDB >nul 2>&1
if %errorlevel% neq 0 (
    echo Warning: Could not start MongoDB service. Make sure MongoDB is installed and configured.
)

echo Starting servers in a single terminal...
echo.

if exist "backend" (
    if exist "frontend" (
        echo Both backend and frontend directories found. Starting both servers...
        echo.
        echo Starting backend server on port 5000 and frontend server on port 3000...
        echo NOTE: Both servers will run in this terminal. Press Ctrl+C to stop.
        echo.
        echo Starting servers...
        npm start
        echo.
        echo Servers stopped.
    ) else (
        echo Frontend directory not found. Starting backend only...
        echo.
        echo Starting backend server on port 5000...
        echo Press Ctrl+C to stop the server.
        echo.
        cd backend
        npm start
        cd ..
    )
) else if exist "frontend" (
    echo Backend directory not found. Starting frontend only...
    echo.
    echo Starting frontend server on port 3000...
    echo Press Ctrl+C to stop the server.
    echo.
    cd frontend
    npm start
    cd ..
) else (
    echo Error: Neither backend nor frontend directories found.
    pause
    goto menu
)

echo.
echo Press any key to return to menu...
pause >nul
goto menu

:stop_server
cls
echo.
echo =====================================================
echo            Stopping MTG Tracker
echo =====================================================
echo.

echo Stopping servers...
taskkill /f /im node.exe 2>nul
if %errorlevel% equ 0 (
    echo Servers stopped successfully.
) else (
    echo No node processes were running or failed to stop.
)

echo.
echo If you need to stop MongoDB service:
echo net stop MongoDB
echo.

pause
goto menu

:restart_server
cls
echo.
echo =====================================================
echo           Restarting MTG Tracker
echo =====================================================
echo.

echo Stopping servers...
taskkill /f /im node.exe 2>nul
if %errorlevel% equ 0 (
    echo Servers stopped successfully.
) else (
    echo No node processes were running or failed to stop.
)

echo.
echo If you need to stop MongoDB service:
echo net stop MongoDB
echo.

echo Starting servers again...
echo Please wait...
timeout /t 3 /nobreak >nul
goto start_server

:exit_program
cls
echo.
echo =====================================================
echo      Thank you for using MTG Tracker Server Manager!
echo =====================================================
echo.
echo Press any key to exit...
pause >nul
exit