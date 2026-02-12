#!/bin/bash

# MTG Tracker Server Manager
# Combines install, start, stop, restart, and update functionality

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[ OK ]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERR]${NC} $1"; }
log_step()    { echo -e "${CYAN}[STEP]${NC} $1"; }

show_menu() {
    clear
    echo ""
    echo "====================================================="
    echo "           MTG Tracker Server Manager"
    echo "====================================================="
    echo ""
    echo " 1. Install/Setup Application"
    echo " 2. Start Server"
    echo " 3. Stop Server"
    echo " 4. Restart Server"
    echo " 5. Update from GitHub"
    echo " 6. Exit"
    echo ""
    read -p "Enter your choice (1-6): " choice
    
    case $choice in
        1) install ;;
        2) start_server ;;
        3) stop_server ;;
        4) restart_server ;;
        5) update_from_github ;;
        6) exit_program ;;
        *) 
            log_error "Invalid choice. Please try again."
            sleep 2
            show_menu ;;
    esac
}

install() {
    clear
    echo ""
    echo "====================================================="
    echo "         Installing MTG Tracker Dependencies"
    echo "====================================================="
    echo ""

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Please install Node.js LTS version."
        log_info "Visit https://nodejs.org/ to download and install."
        read -p "Press Enter to return to menu..."
        show_menu
    else
        log_success "Node.js is installed: $(node --version)"
    fi

    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        log_error "npm not found. Please install Node.js which includes npm."
        read -p "Press Enter to return to menu..."
        show_menu
    else
        log_success "npm is installed: $(npm --version)"
    fi

    # Check if MongoDB is installed
    if ! command -v mongod &> /dev/null; then
        log_warning "MongoDB not found. Please install MongoDB Community Server."
        log_info "Visit https://www.mongodb.com/try/download/community to download and install."
        log_warning "Note: This script cannot automatically install MongoDB on Linux."
    else
        log_success "MongoDB is installed: $(mongod --version | head -n 1)"
    fi

    # Install backend dependencies
    if [ -d "backend" ]; then
        log_step "Installing backend dependencies..."
        cd backend
        if npm install; then
            log_success "Backend dependencies installed successfully."
        else
            log_error "Failed to install backend dependencies."
            read -p "Press Enter to return to menu..."
            cd ..
            show_menu
        fi
        cd ..
    else
        log_warning "Backend directory not found. Skipping backend installation."
    fi

    # Install frontend dependencies
    if [ -d "frontend" ]; then
        log_step "Installing frontend dependencies..."
        cd frontend
        if npm install; then
            log_success "Frontend dependencies installed successfully."
        else
            log_error "Failed to install frontend dependencies."
            read -p "Press Enter to return to menu..."
            cd ..
            show_menu
        fi
        cd ..
    else
        log_warning "Frontend directory not found. Skipping frontend installation."
    fi

    log_success "Installation complete!"
    read -p "Press Enter to return to menu..."
    show_menu
}

start_server() {
    clear
    echo ""
    echo "====================================================="
    echo "              Starting MTG Tracker"
    echo "====================================================="
    echo ""

    # Start MongoDB service if available
    if command -v mongod &> /dev/null; then
        sudo systemctl start mongod 2>/dev/null || log_warning "Could not start MongoDB service automatically. Make sure MongoDB is running."
    else
        log_warning "MongoDB not found. Make sure MongoDB is installed and running."
    fi

    if [ -d "backend" ] && [ -d "frontend" ]; then
        log_step "Starting both backend and frontend servers..."
        echo ""
        echo "Starting servers (press Ctrl+C to stop)..."
        echo ""
        echo "Backend: http://localhost:5000"
        echo "Frontend: http://localhost:3000"
        echo ""
        echo "Running both servers in this terminal..."
        npm start
        log_success "Servers stopped."
    elif [ -d "backend" ]; then
        log_step "Starting backend server only..."
        echo ""
        echo "Starting backend server (press Ctrl+C to stop)..."
        echo "Backend: http://localhost:5000"
        echo ""
        cd backend
        npm start
        cd ..
        log_success "Backend server stopped."
    elif [ -d "frontend" ]; then
        log_step "Starting frontend server only..."
        echo ""
        echo "Starting frontend server (press Ctrl+C to stop)..."
        echo "Frontend: http://localhost:3000"
        echo ""
        cd frontend
        npm start
        cd ..
        log_success "Frontend server stopped."
    else
        log_error "Neither backend nor frontend directories found."
        read -p "Press Enter to return to menu..."
        show_menu
    fi

    echo ""
    echo "Press Enter to return to menu..."
    read
    show_menu
}

stop_server() {
    clear
    echo ""
    echo "====================================================="
    echo "              Stopping MTG Tracker"
    echo "====================================================="
    echo ""

    stop_processes

    log_success "MTG Tracker stopped."
    read -p "Press Enter to return to menu..."
    show_menu
}

stop_processes() {
    log_step "Stopping servers..."
    
    # Kill all node processes
    pkill -f "node" 2>/dev/null
    if [ $? -eq 0 ]; then
        log_success "Node processes stopped."
    else
        log_info "No node processes were running."
    fi

    # Alternative: Kill by specific patterns if needed
    pkill -f "node.*server.js" 2>/dev/null
    pkill -f "react-scripts start" 2>/dev/null
    pkill -f "npm start" 2>/dev/null
    
    log_success "Servers stopped."
}

restart_server() {
    clear
    echo ""
    echo "====================================================="
    echo "             Restarting MTG Tracker"
    echo "====================================================="
    echo ""

    log_step "Stopping servers..."
    stop_processes

    log_step "Waiting before restarting..."
    sleep 3

    # Start servers again
    start_server
}

update_from_github() {
    clear
    echo ""
    echo "====================================================="
    echo "         Updating MTG Tracker from GitHub"
    echo "====================================================="
    echo ""

    # Check if git is installed
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed or not in PATH."
        log_info "Please install Git from https://git-scm.com/"
        read -p "Press Enter to return to menu..."
        show_menu
    fi

    # Check if this is a git repository
    if ! git rev-parse --is-inside-work-tree &> /dev/null 2>&1; then
        log_error "This project is not a git repository yet."
        log_info "Would you like to clone the repository? (y/n)"
        read -r clone_choice
        if [[ $clone_choice =~ ^[Yy]$ ]]; then
            clone_repository
        else
            show_menu
        fi
    fi

    # Record current state
    CURRENT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    log_info "Current version: ${CURRENT_HASH}"

    # Stash local changes if any
    LOCAL_CHANGES=false
    if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
        LOCAL_CHANGES=true
        log_warning "Local changes detected — stashing them..."
        git stash push -m "mtg-update-$(date +%Y%m%d-%H%M%S)" --include-untracked
        log_success "Changes stashed safely"
    else
        log_success "Working directory clean"
    fi

    # Pull latest changes
    log_step "Pulling latest from GitHub..."
    PULL_OUTPUT=$(git pull --rebase 2>&1) || {
        log_error "git pull failed:"
        echo "$PULL_OUTPUT"
        if [ "$LOCAL_CHANGES" = true ]; then
            log_warning "Restoring your local changes..."
            git stash pop
        fi
        read -p "Press Enter to return to menu..."
        show_menu
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

    # Restore local changes if any
    if [ "$LOCAL_CHANGES" = true ]; then
        log_step "Restoring your local changes..."
        if git stash pop 2>/dev/null; then
            log_success "Local changes restored"
        else
            log_warning "Merge conflict when restoring changes."
            log_warning "Your changes are saved in git stash. Run 'git stash pop' manually."
        fi
    fi

    # Install dependencies
    update_dependencies

    # Make sure scripts are executable
    if [ -f "server-manager.sh" ]; then
        chmod +x server-manager.sh 2>/dev/null
    fi
    if [ -f "update.sh" ]; then
        chmod +x update.sh 2>/dev/null
    fi
    if [ -f "start.sh" ]; then
        chmod +x start.sh 2>/dev/null
    fi
    if [ -f "install-linux.sh" ]; then
        chmod +x install-linux.sh 2>/dev/null
    fi

    # Check for .env file
    if [ ! -f "backend/.env" ]; then
        log_warning "No backend/.env file found!"
        log_info "Copy a template:  cp backend/.env.local backend/.env"
    fi

    log_success "Update complete!"
    echo ""
    log_info "Version: ${NEW_HASH}"
    log_info "Would you like to reinstall dependencies? (y/n)"
    read -r reinstall_choice
    if [[ $reinstall_choice =~ ^[Yy]$ ]]; then
        update_dependencies
    fi

    read -p "Press Enter to return to menu..."
    show_menu
}

update_dependencies() {
    log_step "Checking backend dependencies..."
    if [ -d "backend" ]; then
        BACKEND_BEFORE=$(cat backend/package-lock.json 2>/dev/null | wc -c)
        (cd backend && npm install --no-audit --no-fund 2>&1) | tail -1
        BACKEND_AFTER=$(cat backend/package-lock.json 2>/dev/null | wc -c)
        if [ "$BACKEND_BEFORE" != "$BACKEND_AFTER" ]; then
            log_success "Backend dependencies updated"
        else
            log_success "Backend dependencies up to date"
        fi
    else
        log_warning "Backend directory not found. Skipping backend dependency update."
    fi

    log_step "Checking frontend dependencies..."
    if [ -d "frontend" ]; then
        FRONTEND_BEFORE=$(cat frontend/package-lock.json 2>/dev/null | wc -c)
        (cd frontend && npm install --no-audit --no-fund 2>&1) | tail -1
        FRONTEND_AFTER=$(cat frontend/package-lock.json 2>/dev/null | wc -c)
        if [ "$FRONTEND_BEFORE" != "$FRONTEND_AFTER" ]; then
            log_success "Frontend dependencies updated"
        else
            log_success "Frontend dependencies up to date"
        fi
    else
        log_warning "Frontend directory not found. Skipping frontend dependency update."
    fi

    log_step "Checking root dependencies..."
    npm install --no-audit --no-fund 2>&1 | tail -1
    log_success "Root dependencies checked"
}

clone_repository() {
    clear
    echo ""
    echo "====================================================="
    echo "          Cloning MTG Tracker Repository"
    echo "====================================================="
    echo ""

    read -p "Enter repository URL (press Enter for default): " repo_url
    if [ -z "$repo_url" ]; then
        repo_url="https://github.com/CountKrampus/mtgtracking.git"
    fi

    log_info "Cloning repository from: $repo_url"
    if git clone "$repo_url" .; then
        log_success "Repository cloned successfully!"
        log_info "Would you like to install dependencies? (y/n)"
        read -r deps_choice
        if [[ $deps_choice =~ ^[Yy]$ ]]; then
            install
        else
            show_menu
        fi
    else
        log_error "Clone failed. Check the repository URL and network connection."
        read -p "Press Enter to return to menu..."
        show_menu
    fi
}

exit_program() {
    clear
    echo ""
    echo "====================================================="
    echo "      Thank you for using MTG Tracker Server Manager!"
    echo "====================================================="
    echo ""
    exit 0
}

# Main execution
# Navigate to script directory (project root)
cd "$(dirname "$0")"

# Show the menu
show_menu