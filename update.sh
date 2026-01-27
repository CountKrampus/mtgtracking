#!/bin/bash

#################################################################################
# MTG Tracker - Update Script (Linux/Mac)
# Pulls the latest code from GitHub and installs any new dependencies
#################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[ OK ]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERR]${NC} $1"; }
log_step()    { echo -e "${CYAN}[STEP]${NC} $1"; }

# Navigate to script directory (project root)
cd "$(dirname "$0")"

echo ""
log_info "============================================"
log_info "       MTG Tracker - Update Script"
log_info "============================================"
echo ""

# --- Pre-checks ---

if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    log_error "Must be run from the mtg-tracker project root."
    exit 1
fi

if ! command -v git &> /dev/null; then
    log_error "git is not installed. Install it from https://git-scm.com"
    exit 1
fi

if ! git rev-parse --is-inside-work-tree &> /dev/null 2>&1; then
    log_error "This project is not a git repository yet."
    log_info  "First-time setup needed. Run:"
    echo ""
    echo "    git init"
    echo "    git remote add origin <your-github-url>"
    echo "    git add -A && git commit -m \"Initial commit\""
    echo "    git push -u origin main"
    echo ""
    log_info  "After that, your friends can clone and use this update script."
    exit 1
fi

# --- Record current state ---

CURRENT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
log_info "Current version: ${CURRENT_HASH}"

# --- Stash local changes ---

log_step "Checking for local changes..."
LOCAL_CHANGES=false
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    LOCAL_CHANGES=true
    log_warning "Local changes detected — stashing them..."
    git stash push -m "mtg-update-$(date +%Y%m%d-%H%M%S)" --include-untracked
    log_success "Changes stashed safely"
else
    log_success "Working directory clean"
fi

# --- Pull latest ---

log_step "Pulling latest from GitHub..."
PULL_OUTPUT=$(git pull --rebase 2>&1) || {
    log_error "git pull failed:"
    echo "$PULL_OUTPUT"
    if [ "$LOCAL_CHANGES" = true ]; then
        log_warning "Restoring your local changes..."
        git stash pop
    fi
    exit 1
}

NEW_HASH=$(git rev-parse --short HEAD)

if [ "$CURRENT_HASH" = "$NEW_HASH" ]; then
    log_success "Already up to date (${NEW_HASH})"
else
    log_success "Updated: ${CURRENT_HASH} -> ${NEW_HASH}"
    echo ""
    log_info "Changes:"
    git log --oneline "${CURRENT_HASH}..${NEW_HASH}" 2>/dev/null | while read -r line; do
        echo "    $line"
    done
fi

# --- Restore local changes ---

if [ "$LOCAL_CHANGES" = true ]; then
    log_step "Restoring your local changes..."
    if git stash pop 2>/dev/null; then
        log_success "Local changes restored"
    else
        log_warning "Merge conflict when restoring changes."
        log_warning "Your changes are saved in git stash. Run 'git stash pop' manually."
    fi
fi

# --- Install dependencies ---

log_step "Checking backend dependencies..."
BACKEND_BEFORE=$(cat backend/package-lock.json 2>/dev/null | wc -c)
(cd backend && npm install --no-audit --no-fund 2>&1) | tail -1
BACKEND_AFTER=$(cat backend/package-lock.json 2>/dev/null | wc -c)
if [ "$BACKEND_BEFORE" != "$BACKEND_AFTER" ]; then
    log_success "Backend dependencies updated"
else
    log_success "Backend dependencies up to date"
fi

echo ""
log_step "Checking frontend dependencies..."
FRONTEND_BEFORE=$(cat frontend/package-lock.json 2>/dev/null | wc -c)
(cd frontend && npm install --no-audit --no-fund 2>&1) | tail -1
FRONTEND_AFTER=$(cat frontend/package-lock.json 2>/dev/null | wc -c)
if [ "$FRONTEND_BEFORE" != "$FRONTEND_AFTER" ]; then
    log_success "Frontend dependencies updated"
else
    log_success "Frontend dependencies up to date"
fi

echo ""
log_step "Checking root dependencies..."
npm install --no-audit --no-fund 2>&1 | tail -1
log_success "Root dependencies checked"

# --- Check for new scripts ---

if [ -f "update.sh" ]; then
    chmod +x update.sh 2>/dev/null
fi
if [ -f "start.sh" ]; then
    chmod +x start.sh 2>/dev/null
fi
if [ -f "install-linux.sh" ]; then
    chmod +x install-linux.sh 2>/dev/null
fi

# --- Summary ---

echo ""
log_info "============================================"
log_success "       Update complete!"
log_info "============================================"
echo ""
log_info "Version: ${NEW_HASH}"
log_info "Start the app with:  ${GREEN}npm start${NC}  or  ${GREEN}./start.sh${NC}"
echo ""

# --- Check if .env exists ---

if [ ! -f "backend/.env" ]; then
    log_warning "No backend/.env file found!"
    log_info  "Copy a template:  cp backend/.env.local backend/.env"
fi
