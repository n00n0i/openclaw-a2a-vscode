import * as vscode from 'vscode';
import * as http from 'http';
import * as WebSocket from 'ws';
import axios from 'axios';

// A2A Message Types
interface A2AMessage {
    messageId: string;
    fromAgent: string;
    toAgent: string;
    messageType: 'request' | 'response' | 'broadcast';
    capability?: string;
    payload: any;
    timestamp: string;
    replyTo?: string;
}

interface RemoteAgent {
    name: string;
    url: string;
    token?: string;
    status: 'online' | 'offline' | 'unknown';
    capabilities: string[];
    lastSeen?: Date;
}

// Main Extension Class
export class OpenClawA2A {
    private context: vscode.ExtensionContext;
    private server: http.Server | undefined;
    private wss: WebSocket.Server | undefined;
    private agents: Map<string, RemoteAgent> = new Map();
    private outputChannel: vscode.OutputChannel;
    private statusBarItem: vscode.StatusBarItem;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('OpenClaw A2A');
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'openclaw-a2a.showPanel';
        this.updateStatusBar('idle');
    }

    async activate(): Promise<void> {
        this.log('OpenClaw A2A Extension activated');

        // Register commands
        this.registerCommands();

        // Start A2A server if enabled
        const config = vscode.workspace.getConfiguration('openclaw-a2a');
        if (config.get('server.enabled', true)) {
            await this.startServer();
        }

        // Discover configured agents
        await this.discoverAgents();

        // Setup periodic health checks
        setInterval(() => this.checkAgentHealth(), 30000);
    }

    private registerCommands(): void {
        const commands = [
            vscode.commands.registerCommand('openclaw-a2a.discover', () => this.discoverAgents()),
            vscode.commands.registerCommand('openclaw-a2a.sendMessage', () => this.sendMessageUI()),
            vscode.commands.registerCommand('openclaw-a2a.delegateTask', () => this.delegateTaskUI()),
            vscode.commands.registerCommand('openclaw-a2a.startServer', () => this.startServer()),
            vscode.commands.registerCommand('openclaw-a2a.stopServer', () => this.stopServer()),
            vscode.commands.registerCommand('openclaw-a2a.showPanel', () => this.showPanel()),
        ];

        commands.forEach(cmd => this.context.subscriptions.push(cmd));
    }

    // Start A2A HTTP/WebSocket Server
    async startServer(): Promise<void> {
        const config = vscode.workspace.getConfiguration('openclaw-a2a');
        const port = config.get('server.port', 8080);

        if (this.server) {
            vscode.window.showWarningMessage('A2A server already running');
            return;
        }

        try {
            // HTTP Server
            this.server = http.createServer((req, res) => this.handleHttpRequest(req, res));
            
            // WebSocket Server
            this.wss = new WebSocket.Server({ server: this.server });
            this.wss.on('connection', (ws) => this.handleWebSocketConnection(ws));

            this.server.listen(port, () => {
                this.log(`A2A server started on port ${port}`);
                vscode.window.showInformationMessage(`OpenClaw A2A server started on port ${port}`);
                this.updateStatusBar('online');
            });

        } catch (error) {
            this.log(`Failed to start server: ${error}`);
            vscode.window.showErrorMessage(`Failed to start A2A server: ${error}`);
        }
    }

    // Stop A2A Server
    async stopServer(): Promise<void> {
        if (!this.server) {
            vscode.window.showWarningMessage('A2A server not running');
            return;
        }

        this.wss?.close();
        this.server.close(() => {
            this.log('A2A server stopped');
            vscode.window.showInformationMessage('OpenClaw A2A server stopped');
            this.updateStatusBar('offline');
        });

        this.server = undefined;
        this.wss = undefined;
    }

    // Handle HTTP requests
    private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        const url = req.url || '';
        
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // Verify token
        const config = vscode.workspace.getConfiguration('openclaw-a2a');
        const expectedToken = config.get('server.token', '');
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');

        if (expectedToken && token !== expectedToken) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }

        // Routes
        if (url === '/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'healthy',
                agent: 'vscode-server',
                capabilities: config.get('capabilities', []),
                timestamp: new Date().toISOString()
            }));
        }
        else if (url === '/a2a/receive' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const message: A2AMessage = JSON.parse(body);
                    const result = await this.handleIncomingMessage(message);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid message' }));
                }
            });
        }
        else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    }

    // Handle WebSocket connections
    private handleWebSocketConnection(ws: WebSocket): void {
        this.log('New WebSocket connection');
        
        ws.on('message', async (data) => {
            try {
                const message: A2AMessage = JSON.parse(data.toString());
                const result = await this.handleIncomingMessage(message);
                ws.send(JSON.stringify(result));
            } catch (error) {
                ws.send(JSON.stringify({ error: 'Invalid message' }));
            }
        });

        ws.on('close', () => {
            this.log('WebSocket connection closed');
        });
    }

    // Handle incoming A2A message
    private async handleIncomingMessage(message: A2AMessage): Promise<any> {
        this.log(`Received message from ${message.fromAgent}: ${message.capability}`);

        switch (message.capability) {
            case 'file_operation':
                return this.handleFileOperation(message.payload);
            case 'terminal':
                return this.handleTerminalCommand(message.payload);
            case 'docker':
                return this.handleDockerOperation(message.payload);
            case 'vscode':
                return this.handleVSCodeOperation(message.payload);
            default:
                return { error: `Unknown capability: ${message.capability}` };
        }
    }

    // File operations
    private async handleFileOperation(payload: any): Promise<any> {
        const fs = await import('fs');
        const path = await import('path');
        
        const { action, filePath, content } = payload;
        const fullPath = path.join(vscode.workspace.workspaceFolders?.[0].uri.fsPath || '', filePath);

        switch (action) {
            case 'read':
                return { content: fs.readFileSync(fullPath, 'utf-8') };
            case 'write':
                fs.writeFileSync(fullPath, content);
                return { status: 'written' };
            case 'list':
                return { files: fs.readdirSync(fullPath) };
            default:
                return { error: 'Unknown file action' };
        }
    }

    // Terminal commands
    private async handleTerminalCommand(payload: any): Promise<any> {
        const { command, cwd } = payload;
        
        const terminal = vscode.window.createTerminal('A2A Remote');
        terminal.show();
        terminal.sendText(command);
        
        return { status: 'executed', command };
    }

    // Docker operations
    private async handleDockerOperation(payload: any): Promise<any> {
        // Delegate to local Docker
        return { status: 'docker_operation', payload };
    }

    // VS Code specific operations
    private async handleVSCodeOperation(payload: any): Promise<any> {
        const { action, ...params } = payload;
        
        switch (action) {
            case 'openFile':
                const doc = await vscode.workspace.openTextDocument(params.path);
                await vscode.window.showTextDocument(doc);
                return { status: 'opened' };
            case 'executeCommand':
                await vscode.commands.executeCommand(params.command, ...params.args);
                return { status: 'executed' };
            default:
                return { error: 'Unknown VS Code action' };
        }
    }

    // Send message to remote agent
    async sendMessage(agentName: string, message: A2AMessage): Promise<any> {
        const agent = this.agents.get(agentName);
        if (!agent) {
            throw new Error(`Agent ${agentName} not found`);
        }

        try {
            const response = await axios.post(
                `${agent.url}/a2a/receive`,
                message,
                {
                    headers: agent.token ? { 'Authorization': `Bearer ${agent.token}` } : {},
                    timeout: 60000
                }
            );
            return response.data;
        } catch (error) {
            this.log(`Failed to send message to ${agentName}: ${error}`);
            throw error;
        }
    }

    // Discover configured agents
    async discoverAgents(): Promise<void> {
        const config = vscode.workspace.getConfiguration('openclaw-a2a');
        const configuredAgents = config.get('agents', []) as RemoteAgent[];

        for (const agentConfig of configuredAgents) {
            try {
                const response = await axios.get(
                    `${agentConfig.url}/health`,
                    {
                        headers: agentConfig.token ? { 'Authorization': `Bearer ${agentConfig.token}` } : {},
                        timeout: 5000
                    }
                );

                const agent: RemoteAgent = {
                    ...agentConfig,
                    status: 'online',
                    capabilities: response.data.capabilities || [],
                    lastSeen: new Date()
                };

                this.agents.set(agentConfig.name, agent);
                this.log(`Discovered agent: ${agent.name} (${agent.status})`);

            } catch (error) {
                const agent: RemoteAgent = {
                    ...agentConfig,
                    status: 'offline',
                    capabilities: []
                };
                this.agents.set(agentConfig.name, agent);
                this.log(`Agent offline: ${agent.name}`);
            }
        }

        // Update tree view
        this.updateAgentTreeView();
    }

    // Check agent health periodically
    private async checkAgentHealth(): Promise<void> {
        for (const [name, agent] of this.agents) {
            try {
                await axios.get(`${agent.url}/health`, { timeout: 5000 });
                agent.status = 'online';
                agent.lastSeen = new Date();
            } catch {
                agent.status = 'offline';
            }
        }
        this.updateAgentTreeView();
    }

    // UI: Send message
    private async sendMessageUI(): Promise<void> {
        const agentNames = Array.from(this.agents.keys());
        if (agentNames.length === 0) {
            vscode.window.showWarningMessage('No agents configured. Add agents in settings.');
            return;
        }

        const agent = await vscode.window.showQuickPick(agentNames, {
            placeHolder: 'Select target agent'
        });
        if (!agent) return;

        const capability = await vscode.window.showQuickPick([
            'file_operation',
            'terminal',
            'docker',
            'vscode'
        ], { placeHolder: 'Select capability' });
        if (!capability) return;

        const payloadStr = await vscode.window.showInputBox({
            placeHolder: 'Enter payload (JSON)',
            value: '{}'
        });
        if (!payloadStr) return;

        try {
            const message: A2AMessage = {
                messageId: `msg-${Date.now()}`,
                fromAgent: 'vscode-local',
                toAgent: agent,
                messageType: 'request',
                capability,
                payload: JSON.parse(payloadStr),
                timestamp: new Date().toISOString()
            };

            const result = await this.sendMessage(agent, message);
            this.outputChannel.appendLine(`Result: ${JSON.stringify(result, null, 2)}`);
            vscode.window.showInformationMessage('Message sent successfully');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed: ${error}`);
        }
    }

    // UI: Delegate task
    private async delegateTaskUI(): Promise<void> {
        const tasks = [
            { label: 'Train Model (GPU)', agent: 'machine-b', capability: 'gpu_training' },
            { label: 'Print Document', agent: 'machine-c', capability: 'printer' },
            { label: 'Run Experiment', agent: 'machine-b', capability: 'experiment' }
        ];

        const task = await vscode.window.showQuickPick(tasks, {
            placeHolder: 'Select task to delegate'
        });
        if (!task) return;

        vscode.window.showInformationMessage(`Delegating to ${task.agent}...`);
        // Implementation...
    }

    // UI: Show panel
    private showPanel(): void {
        this.outputChannel.show();
    }

    // Update status bar
    private updateStatusBar(status: 'idle' | 'online' | 'offline'): void {
        const icons = {
            idle: '$(broadcast)',
            online: '$(broadcast)',
            offline: '$(debug-disconnect)'
        };
        const colors = {
            idle: undefined,
            online: undefined,
            offline: new vscode.ThemeColor('statusBarItem.errorBackground')
        };

        this.statusBarItem.text = `${icons[status]} A2A`;
        this.statusBarItem.backgroundColor = colors[status];
        this.statusBarItem.tooltip = `OpenClaw A2A: ${status}`;
        this.statusBarItem.show();
    }

    // Update agent tree view
    private updateAgentTreeView(): void {
        // Trigger tree refresh
        vscode.commands.executeCommand('openclaw-a2a.refreshAgents');
    }

    // Logging
    private log(message: string): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    // Deactivate
    deactivate(): void {
        this.stopServer();
        this.outputChannel.dispose();
        this.statusBarItem.dispose();
    }
}
