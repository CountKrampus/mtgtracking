#!/bin/bash

#################################################################################
# MTG Tracker - Linux Automatic Installer
# This script installs all prerequisites and sets up the application
#################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   log_error "This script should NOT be run as root. Run without sudo."
   log_info "The script will ask for your password when needed."
   exit 1
fi

echo ""
log_info "╔════════════════════════════════════════════════════════════╗"
log_info "║          MTG Tracker - Automatic Linux Installer          ║"
log_info "╚════════════════════════════════════════════════════════════╝"
echo ""

# Detect Linux distribution
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
        VERSION=$VERSION_ID
    else
        log_error "Cannot detect Linux distribution"
        exit 1
    fi
    log_info "Detected distribution: $DISTRO $VERSION"
}

# Install Node.js
install_nodejs() {
    log_info "Checking Node.js installation..."

    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log_success "Node.js already installed: $NODE_VERSION"

        # Check if version is adequate (18+)
        NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_MAJOR" -lt 18 ]; then
            log_warning "Node.js version is old. Installing newer version..."
        else
            return 0
        fi
    fi

    log_info "Installing Node.js..."

    case $DISTRO in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        fedora)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo dnf install -y nodejs
            ;;
        rhel|centos)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo yum install -y nodejs
            ;;
        arch|manjaro)
            sudo pacman -S --noconfirm nodejs npm
            ;;
        *)
            log_error "Unsupported distribution for automatic Node.js installation"
            log_info "Please install Node.js 18+ manually: https://nodejs.org/"
            exit 1
            ;;
    esac

    log_success "Node.js installed: $(node --version)"
    log_success "npm installed: $(npm --version)"
}

# Install MongoDB
install_mongodb() {
    log_info "Checking MongoDB installation..."

    if command -v mongod &> /dev/null; then
        MONGO_VERSION=$(mongod --version | head -n 1)
        log_success "MongoDB already installed: $MONGO_VERSION"
        return 0
    fi

    log_info "Installing MongoDB 7.0..."

    case $DISTRO in
        ubuntu)
            # Import GPG key
            curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
                sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

            # Determine Ubuntu version codename
            UBUNTU_CODENAME=$(lsb_release -cs)

            # Add repository
            echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $UBUNTU_CODENAME/mongodb-org/7.0 multiverse" | \
                sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

            # Install
            sudo apt-get update
            sudo apt-get install -y mongodb-org
            ;;
        debian)
            curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
                sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

            echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/debian bullseye/mongodb-org/7.0 main" | \
                sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

            sudo apt-get update
            sudo apt-get install -y mongodb-org
            ;;
        fedora)
            sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo << EOF
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF
            sudo dnf install -y mongodb-org
            ;;
        rhel|centos)
            sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo << EOF
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF
            sudo yum install -y mongodb-org
            ;;
        arch|manjaro)
            log_warning "MongoDB not in official Arch repos. Using AUR..."
            log_info "Install manually with: yay -S mongodb-bin"
            log_info "Or use MongoDB Atlas (cloud) instead."
            read -p "Continue without MongoDB? (Y/n): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
            return 0
            ;;
        *)
            log_warning "Cannot auto-install MongoDB for this distribution"
            log_info "Please install MongoDB manually or use MongoDB Atlas (cloud)"
            return 0
            ;;
    esac

    log_success "MongoDB installed successfully"
}

# Start MongoDB service
start_mongodb() {
    if ! command -v mongod &> /dev/null; then
        log_warning "MongoDB not installed, skipping service start"
        return 0
    fi

    log_info "Starting MongoDB service..."

    # Determine service name
    if systemctl list-unit-files | grep -q "mongod.service"; then
        SERVICE_NAME="mongod"
    elif systemctl list-unit-files | grep -q "mongodb.service"; then
        SERVICE_NAME="mongodb"
    else
        log_warning "Cannot find MongoDB service"
        return 0
    fi

    sudo systemctl start $SERVICE_NAME
    sudo systemctl enable $SERVICE_NAME

    if systemctl is-active --quiet $SERVICE_NAME; then
        log_success "MongoDB service started and enabled"
    else
        log_warning "MongoDB service may not be running. Check with: sudo systemctl status $SERVICE_NAME"
    fi
}

# Install project dependencies
install_dependencies() {
    log_info "Installing project dependencies..."

    # Backend dependencies
    if [ -d "backend" ]; then
        log_info "Installing backend dependencies..."
        cd backend
        npm install
        cd ..
        log_success "Backend dependencies installed"
    else
        log_error "backend/ directory not found!"
        exit 1
    fi

    # Frontend dependencies
    if [ -d "frontend" ]; then
        log_info "Installing frontend dependencies..."
        cd frontend
        npm install
        cd ..
        log_success "Frontend dependencies installed"
    else
        log_error "frontend/ directory not found!"
        exit 1
    fi

    # Root dependencies (concurrently)
    log_info "Installing root dependencies..."
    npm install
    log_success "Root dependencies installed"
}

# Configure environment
configure_environment() {
    log_info "Configuring environment..."

    if [ ! -f "backend/.env" ]; then
        if [ -f "backend/.env.local" ]; then
            cp backend/.env.local backend/.env
            log_success "Created backend/.env from .env.local (local MongoDB)"
        else
            log_warning "No .env.local template found"
            log_info "Creating default .env file..."
            cat > backend/.env << EOF
MONGODB_URI=mongodb://localhost:27017/mtg-tracker
PORT=5000
EOF
            log_success "Created default backend/.env"
        fi
    else
        log_success "backend/.env already exists"
    fi
}

# Make scripts executable
make_scripts_executable() {
    log_info "Making scripts executable..."

    if [ -f "start.sh" ]; then
        chmod +x start.sh
        log_success "start.sh is now executable"
    fi

    if [ -f "install-linux.sh" ]; then
        chmod +x install-linux.sh
        log_success "install-linux.sh is now executable"
    fi
}

# Test installation
test_installation() {
    log_info "Testing installation..."

    # Check Node.js
    if command -v node &> /dev/null; then
        log_success "✓ Node.js: $(node --version)"
    else
        log_error "✗ Node.js not found"
    fi

    # Check npm
    if command -v npm &> /dev/null; then
        log_success "✓ npm: $(npm --version)"
    else
        log_error "✗ npm not found"
    fi

    # Check MongoDB
    if command -v mongod &> /dev/null; then
        log_success "✓ MongoDB: $(mongod --version | head -n 1 | cut -d' ' -f3)"
    else
        log_warning "✗ MongoDB not found (you can use MongoDB Atlas instead)"
    fi

    # Check dependencies
    if [ -d "backend/node_modules" ]; then
        log_success "✓ Backend dependencies installed"
    else
        log_error "✗ Backend dependencies missing"
    fi

    if [ -d "frontend/node_modules" ]; then
        log_success "✓ Frontend dependencies installed"
    else
        log_error "✗ Frontend dependencies missing"
    fi

    if [ -d "node_modules" ]; then
        log_success "✓ Root dependencies installed"
    else
        log_error "✗ Root dependencies missing"
    fi

    # Check .env
    if [ -f "backend/.env" ]; then
        log_success "✓ Environment configured (backend/.env)"
    else
        log_error "✗ backend/.env not found"
    fi
}

# Main installation flow
main() {
    # Check if we're in the project directory
    if [ ! -f "package.json" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
        log_error "This script must be run from the mtg-tracker project root directory"
        log_info "Current directory: $(pwd)"
        exit 1
    fi

    detect_distro
    echo ""

    install_nodejs
    echo ""

    install_mongodb
    echo ""

    start_mongodb
    echo ""

    install_dependencies
    echo ""

    configure_environment
    echo ""

    make_scripts_executable
    echo ""

    test_installation
    echo ""

    log_success "╔════════════════════════════════════════════════════════════╗"
    log_success "║              Installation Complete! 🎉                    ║"
    log_success "╚════════════════════════════════════════════════════════════╝"
    echo ""
    log_info "To start the application, run:"
    echo ""
    echo -e "    ${GREEN}npm start${NC}     (cross-platform)"
    echo -e "    ${GREEN}./start.sh${NC}    (Linux/Mac script)"
    echo ""
    log_info "Access the app at: ${GREEN}http://localhost:3000${NC}"
    log_info "Backend API at: ${GREEN}http://localhost:5000${NC}"
    echo ""
    log_info "Press Ctrl+C to stop the servers"
    echo ""

    # Ask if user wants to start now
    read -p "Start the application now? (Y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        log_info "Starting application..."
        npm start
    else
        log_info "You can start it later with: npm start"
    fi
}

# Run main function
main
