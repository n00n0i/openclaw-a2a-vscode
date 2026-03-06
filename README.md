# OpenClaw A2A - VS Code Extension

Cross-machine agent communication for VS Code Server.

## Features

- 🤖 **Agent Discovery** - Find and connect to remote agents
- 💬 **Message Passing** - Send/receive messages between machines
- 🔄 **Task Delegation** - Delegate tasks to remote agents
- 🔒 **Secure** - Token-based authentication
- ⚡ **Real-time** - WebSocket support

## Quick Start

### 1. Build Extension

```bash
cd openclaw-a2a-vscode
npm install
npm run compile
npm run package
```

### 2. Install in VS Code Server

```bash
# On Machine A
code-server --install-extension openclaw-a2a-0.1.0.vsix

# On Machine B
code-server --install-extension openclaw-a2a-0.1.0.vsix
```

### 3. Configure

**Machine A (Local):**
```json
// settings.json
{
  "openclaw-a2a.server.enabled": true,
  "openclaw-a2a.server.port": 8080,
  "openclaw-a2a.server.token": "your-secret-token",
  "openclaw-a2a.agents": [
    {
      "name": "machine-b",
      "url": "http://machine-b-ip:8080",
      "token": "your-secret-token"
    }
  ]
}
```

**Machine B (Remote):**
```json
{
  "openclaw-a2a.server.enabled": true,
  "openclaw-a2a.server.port": 8080,
  "openclaw-a2a.server.token": "your-secret-token"
}
```

### 4. Use

- Press `Ctrl+Shift+A` to open A2A panel
- Click "Discover Agents" to find remote machines
- Send messages or delegate tasks

## Commands

| Command | Keybinding | Description |
|:---|:---:|:---|
| `OpenClaw A2A: Show Panel` | `Ctrl+Shift+A` | Open A2A panel |
| `OpenClaw A2A: Discover Agents` | - | Find remote agents |
| `OpenClaw A2A: Send Message` | - | Send message to agent |
| `OpenClaw A2A: Delegate Task` | - | Delegate task to remote |

## Capabilities

Local capabilities you can expose:
- `file_operation` - Read/write files
- `terminal` - Execute commands
- `docker` - Docker operations
- `vscode` - VS Code operations

## Example: Cross-Machine Workflow

```typescript
// Machine A sends file to Machine B for GPU training
const result = await a2a.sendMessage('machine-b', {
  messageId: 'train-001',
  fromAgent: 'machine-a',
  toAgent: 'machine-b',
  messageType: 'request',
  capability: 'gpu_training',
  payload: {
    dataset: '/data/images.zip',
    model: 'yolov8',
    epochs: 100
  }
});

// Result: { modelPath: '/models/trained.pt', accuracy: 0.94 }
```

## Architecture

```
Machine A (VS Code Server)          Machine B (VS Code Server)
┌─────────────────────────┐        ┌─────────────────────────┐
│  OpenClaw A2A Extension │◄──────►│  OpenClaw A2A Extension │
│  ┌───────────────────┐  │  HTTP  │  ┌───────────────────┐  │
│  │ A2A Server :8080  │◄─┼────────┼─►│ A2A Server :8080  │  │
│  └───────────────────┘  │        │  └───────────────────┘  │
│           │             │        │           │             │
│           ▼             │        │           ▼             │
│  ┌───────────────────┐  │        │  ┌───────────────────┐  │
│  │ Local Tools       │  │        │  │ Local Tools       │  │
│  │ - File system     │  │        │  │ - GPU Training    │  │
│  │ - Terminal        │  │        │  │ - Docker          │  │
│  │ - Docker          │  │        │  │ - Printer         │  │
│  └───────────────────┘  │        │  └───────────────────┘  │
└─────────────────────────┘        └─────────────────────────┘
```

## Requirements

- VS Code 1.74+ or code-server
- Node.js 16+
- Network connectivity between machines

## License

MIT
