#!/bin/bash
# OpenClaw A2A VS Code Extension - One-Line Installer
# Usage: curl -fsSL https://.../install.sh | bash

set -e

REPO_URL="https://github.com/n00n0i/openclaw-a2a-vscode"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.openclaw/extensions/openclaw-a2a-vscode}"
VERSION="${VERSION:-main}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

log_info() { echo -e "${GREEN}✓${NC} $1"; }
log_step() { echo -e "${BLUE}→${NC} ${BOLD}$1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

print_banner() {
    cat << 'EOF'
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     🔗 OpenClaw A2A VS Code Extension Installer           ║
║                                                           ║
║     Cross-machine agent communication                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

EOF
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

detect_os() {
    case "$OSTYPE" in
        linux-gnu*) echo "Linux" ;;
        darwin*) echo "macOS" ;;
        msys*) echo "Windows" ;;
        *) echo "Unknown" ;;
    esac
}

check_prerequisites() {
    log_step "Checking prerequisites..."
    
    if ! command_exists code-server; then
        log_warn "code-server not found. You'll need to install manually."
    else
        log_info "code-server found"
    fi
    
    log_success "Prerequisites checked"
}

download_repo() {
    log_step "Downloading VS Code Extension..."
    
    if [ -d "$INSTALL_DIR" ]; then
        log_warn "Directory exists: $INSTALL_DIR"
        read -p "  Overwrite? [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Installation cancelled"
            exit 0
        fi
        rm -rf "$INSTALL_DIR"
    fi
    
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Download files
    curl -fsSL "$REPO_URL/raw/$VERSION/package.json" -o package.json
    curl -fsSL "$REPO_URL/raw/$VERSION/tsconfig.json" -o tsconfig.json
    curl -fsSL "$REPO_URL/raw/$VERSION/README.md" -o README.md
    
    # Create src directory
    mkdir -p src
    curl -fsSL "$REPO_URL/raw/$VERSION/src/extension.ts" -o src/extension.ts
    curl -fsSL "$REPO_URL/raw/$VERSION/src/index.ts" -o src/index.ts
    
    log_success "Downloaded to $INSTALL_DIR"
}

build_extension() {
    log_step "Building extension..."
    
    cd "$INSTALL_DIR"
    
    if command_exists npm; then
        npm install 2>/dev/null || log_warn "npm install failed, may need manual install"
        npm run compile 2>/dev/null || log_warn "Build failed, may need manual build"
    else
        log_warn "npm not found. Please install Node.js and run 'npm install' manually"
    fi
    
    log_success "Build attempted"
}

install_extension() {
    if command_exists code-server; then
        log_step "Installing in code-server..."
        
        cd "$INSTALL_DIR"
        
        if [ -f "openclaw-a2a-0.1.0.vsix" ]; then
            code-server --install-extension openclaw-a2a-0.1.0.vsix
            log_success "Extension installed"
        else
            log_warn "VSIX file not found. Build may have failed."
            log_info "To install manually: code-server --install-extension openclaw-a2a-0.1.0.vsix"
        fi
    fi
}

print_completion() {
    echo ""
    echo "========================================"
    echo "  🎉 Installation Complete!"
    echo "========================================"
    echo ""
    echo -e "${BOLD}📁 Location:${NC} $INSTALL_DIR"
    echo ""
    echo -e "${BOLD}🚀 Quick Start:${NC}"
    echo ""
    echo "  1. Build (if not already built):"
    echo "     cd $INSTALL_DIR"
    echo "     npm install"
    echo "     npm run compile"
    echo "     npm run package"
    echo ""
    echo "  2. Install:"
    echo "     code-server --install-extension openclaw-a2a-0.1.0.vsix"
    echo ""
    echo "  3. Configure:"
    echo "     Edit ~/.local/share/code-server/User/settings.json"
    echo ""
    echo "  4. Use:"
    echo "     Press Ctrl+Shift+A to open A2A panel"
    echo ""
    echo "========================================"
}

main() {
    print_banner
    echo "Version: $VERSION"
    echo "OS: $(detect_os)"
    echo ""
    
    check_prerequisites
    download_repo
    build_extension
    install_extension
    
    print_completion
}

trap 'echo "" ; log_error "Installation interrupted" ; exit 1' INT TERM

main
