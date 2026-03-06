#!/bin/bash
# OpenClaw A2A Extension Installer for VS Code Server

set -e

echo "Installing OpenClaw A2A Extension..."

# Check code-server
if ! command -v code-server &> /dev/null; then
    echo "❌ code-server not found"
    exit 1
fi

# Download extension
echo "📥 Downloading extension..."
curl -fsSL -o /tmp/openclaw-a2a.vsix \
    https://github.com/n00n0i/openclaw-a2a-vscode/releases/download/v0.1.0/openclaw-a2a-0.1.0.vsix

# Install
echo "🔧 Installing..."
code-server --install-extension /tmp/openclaw-a2a.vsix

# Configure
echo "⚙️  Configuring..."
mkdir -p ~/.local/share/code-server/User
cat > ~/.local/share/code-server/User/settings.json << 'EOF'
{
    "openclaw-a2a.server.enabled": true,
    "openclaw-a2a.server.port": 8080,
    "openclaw-a2a.agents": []
}
EOF

echo "✅ Installation complete!"
echo ""
echo "🚀 Usage:"
echo "   1. Open VS Code Server"
echo "   2. Press Ctrl+Shift+P"
echo "   3. Type 'OpenClaw A2A'"
echo ""
echo "⚙️  Configure agents in settings:"
echo '   "openclaw-a2a.agents": ['
echo '       {'
echo '           "name": "Machine-B",'
echo '           "url": "http://machine-b-ip:8080",'
echo '           "token": "secret"'
echo '       }'
echo '   ]'
