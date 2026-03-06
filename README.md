# OpenClaw A2A Extension for VS Code Server

Cross-machine agent communication for VS Code Server.

## Features

- 🔄 **Agent-to-Agent Communication** - Talk between VS Code Servers
- 📁 **Remote File Operations** - Read/write files on remote machines  
- 💻 **Remote Terminal** - Execute commands on other machines
- 🔍 **Auto-Discovery** - Find agents on network
- 🔐 **Secure** - Token-based authentication

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/n00n0i/openclaw-a2a-vscode/main/install.sh | bash
```

## Manual Install

```bash
# Download
curl -fsSL -o openclaw-a2a.vsix \
    https://github.com/n00n0i/openclaw-a2a-vscode/releases/download/v0.1.0/openclaw-a2a-0.1.0.vsix

# Install
code-server --install-extension openclaw-a2a.vsix
```

## Configuration

Add to `~/.local/share/code-server/User/settings.json`:

```json
{
    "openclaw-a2a.server.enabled": true,
    "openclaw-a2a.server.port": 8080,
    "openclaw-a2a.server.token": "your-secret-token",
    "openclaw-a2a.agents": [
        {
            "name": "Machine-B",
            "url": "http://192.168.1.100:8080",
            "token": "shared-secret",
            "capabilities": ["gpu", "storage"]
        }
    ]
}
```

## Usage

### Commands

| Command | Description |
|:---|:---|
| `OpenClaw A2A: Start Server` | Start A2A server on this machine |
| `OpenClaw A2A: Stop Server` | Stop A2A server |
| `OpenClaw A2A: Send Message` | Send message to remote agent |
| `OpenClaw A2A: Discover Agents` | Find agents on network |

### Example: Cross-Machine File Read

```typescript
// From Machine A
const response = await sendMessage({
    toAgent: "Machine-B",
    capability: "file",
    payload: {
        action: "read",
        path: "/remote/path/file.txt"
    }
});

console.log(response.content); // File content from Machine B
```

### Example: Remote Terminal

```typescript
// Execute command on Machine B
await sendMessage({
    toAgent: "Machine-B",
    capability: "terminal",
    payload: {
        command: "nvidia-smi"
    }
});
```

## Architecture

```
Machine A (VS Code Server)          Machine B (VS Code Server)
├─ OpenClaw A2A Extension           ├─ OpenClaw A2A Extension
│  ├─ HTTP Server (port 8080)  ◄────┤  ├─ HTTP Server (port 8080)
│  ├─ File Operations                 │  ├─ File Operations
│  ├─ Terminal                        │  ├─ Terminal
│  └─ Local Tools                     │  └─ GPU, Docker, etc.
```

## API

### Health Check
```bash
GET http://machine-b:8080/health
```

### Send Message
```bash
POST http://machine-b:8080/a2a/receive
Content-Type: application/json

{
    "messageId": "msg-001",
    "fromAgent": "Machine-A",
    "toAgent": "Machine-B",
    "messageType": "request",
    "capability": "file",
    "payload": {"action": "read", "path": "/tmp/test.txt"},
    "timestamp": "2024-01-15T10:00:00Z"
}
```

## Capabilities

| Capability | Description |
|:---|:---|
| `file` | Read/write/list files |
| `terminal` | Execute terminal commands |
| `docker` | Docker operations |
| `openclaw` | OpenClaw tool execution |

## License

MIT
