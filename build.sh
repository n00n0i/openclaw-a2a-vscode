#!/bin/bash
# Build OpenClaw A2A Extension

set -e

echo "========================================"
echo "  Building OpenClaw A2A Extension"
echo "========================================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 16+"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js 16+ required. Found: $(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version)"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install

# Compile TypeScript
echo "Compiling TypeScript..."
npm run compile

# Package extension
echo "Packaging extension..."
npx vsce package --out openclaw-a2a-0.1.0.vsix

echo ""
echo "========================================"
echo "  Build Complete!"
echo "========================================"
echo ""
echo "Output: openclaw-a2a-0.1.0.vsix"
echo ""
echo "Install in VS Code Server:"
echo "  code-server --install-extension openclaw-a2a-0.1.0.vsix"
echo ""
