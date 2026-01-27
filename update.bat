@echo off
setlocal EnableDelayedExpansion

REM =========================================================================
REM MTG Tracker - Update Script (Windows)
REM Pulls the latest code from GitHub and installs any new dependencies
REM =========================================================================

echo.
echo ============================================
echo        MTG Tracker - Update Script
echo ============================================
echo.

REM --- Pre-checks ---

if not exist "package.json" (
    echo [ERR] Must be run from the mtg-tracker project root.
    pause
    exit /b 1
)
if not exist "backend" (
    echo [ERR] Must be run from the mtg-tracker project root.
    pause
    exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
    echo [ERR] git is not installed. Install it from https://git-scm.com
    pause
    exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
    echo [ERR] This project is not a git repository yet.
    echo [INFO] First-time setup needed. Run:
    echo.
    echo     git init
    echo     git remote add origin ^<your-github-url^>
    echo     git add -A ^&^& git commit -m "Initial commit"
    echo     git push -u origin main
    echo.
    echo [INFO] After that, your friends can clone and use this update script.
    pause
    exit /b 1
)

REM --- Record current state ---

for /f "tokens=*" %%i in ('git rev-parse --short HEAD 2^>nul') do set CURRENT_HASH=%%i
echo [INFO] Current version: %CURRENT_HASH%

REM --- Stash local changes ---

echo [STEP] Checking for local changes...
git diff --quiet 2>nul
set DIFF_RESULT=%errorlevel%
git diff --cached --quiet 2>nul
set CACHED_RESULT=%errorlevel%

set LOCAL_CHANGES=0
if %DIFF_RESULT% neq 0 set LOCAL_CHANGES=1
if %CACHED_RESULT% neq 0 set LOCAL_CHANGES=1

if %LOCAL_CHANGES% equ 1 (
    echo [WARN] Local changes detected - stashing them...
    git stash push -m "mtg-update-%date:~-4%%date:~4,2%%date:~7,2%" --include-untracked
    echo [ OK ] Changes stashed safely
) else (
    echo [ OK ] Working directory clean
)

REM --- Pull latest ---

echo [STEP] Pulling latest from GitHub...
git pull --rebase
if errorlevel 1 (
    echo [ERR] git pull failed!
    if %LOCAL_CHANGES% equ 1 (
        echo [WARN] Restoring your local changes...
        git stash pop
    )
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('git rev-parse --short HEAD') do set NEW_HASH=%%i

if "%CURRENT_HASH%"=="%NEW_HASH%" (
    echo [ OK ] Already up to date ^(%NEW_HASH%^)
) else (
    echo [ OK ] Updated: %CURRENT_HASH% -^> %NEW_HASH%
    echo.
    echo [INFO] Changes:
    git log --oneline %CURRENT_HASH%..%NEW_HASH%
)

REM --- Restore local changes ---

if %LOCAL_CHANGES% equ 1 (
    echo [STEP] Restoring your local changes...
    git stash pop >nul 2>nul
    if errorlevel 1 (
        echo [WARN] Merge conflict when restoring changes.
        echo [WARN] Your changes are saved in git stash. Run 'git stash pop' manually.
    ) else (
        echo [ OK ] Local changes restored
    )
)

REM --- Install dependencies ---

echo.
echo [STEP] Checking backend dependencies...
cd backend
call npm install --no-audit --no-fund >nul 2>nul
echo [ OK ] Backend dependencies checked
cd ..

echo [STEP] Checking frontend dependencies...
cd frontend
call npm install --no-audit --no-fund >nul 2>nul
echo [ OK ] Frontend dependencies checked
cd ..

echo [STEP] Checking root dependencies...
call npm install --no-audit --no-fund >nul 2>nul
echo [ OK ] Root dependencies checked

REM --- Summary ---

echo.
echo ============================================
echo [ OK ]  Update complete!
echo ============================================
echo.
echo [INFO] Version: %NEW_HASH%
echo [INFO] Start the app with:  npm start  or  start.bat
echo.

REM --- Check .env ---

if not exist "backend\.env" (
    echo [WARN] No backend\.env file found!
    echo [INFO] Copy a template:  copy backend\.env.local backend\.env
    echo.
)

pause
