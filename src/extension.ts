import * as vscode from 'vscode';
import * as http from 'http';
import axios from 'axios';

interface A2AMessage {
    messageId: string;
    fromAgent: string;
    toAgent: string;
    messageType: 'request' | 'response';
    capability?: string;
    payload: any;
    timestamp: string;
}

export function activate(context: vscode.ExtensionContext) {
    const a2a = new OpenClawA2A(context);
    a2a.activate();
}

class OpenClawA2A {
    private context: vscode.ExtensionContext;
    private server: http.Server | null = null;
    private outputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('OpenClaw A2A');
    }

    async activate() {
        this.log('OpenClaw A2A activated');
        
        this.context.subscriptions.push(
            vscode.commands.registerCommand('openclaw-a2a.startServer', () => this.startServer()),
            vscode.commands.registerCommand('openclaw-a2a.stopServer', () => this.stopServer()),
            vscode.commands.registerCommand('openclaw-a2a.sendMessage', () => this.sendMessage()),
            vscode.commands.registerCommand('openclaw-a2a.discover', () => this.discover())
        );

        // Auto-start server
        this.startServer();
    }

    private async startServer() {
        if (this.server) return;

        const config = vscode.workspace.getConfiguration('openclaw-a2a');
        const port = config.get('server.port', 8080);

        this.server = http.createServer((req, res) => {
            if (req.url === '/health') {
                res.writeHead(200);
                res.end(JSON.stringify({ status: 'ok', agent: 'vscode-server' }));
            } else if (req.url === '/a2a/receive' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    const msg = JSON.parse(body);
                    this.handleMessage(msg).then(result => {
                        res.writeHead(200);
                        res.end(JSON.stringify(result));
                    });
                });
            }
        });

        this.server.listen(port, () => {
            this.log(`Server running on port ${port}`);
            vscode.window.showInformationMessage(`A2A Server: port ${port}`);
        });
    }

    private async stopServer() {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.log('Server stopped');
        }
    }

    private async handleMessage(msg: A2AMessage) {
        this.log(`From ${msg.fromAgent}: ${msg.capability}`);

        if (msg.capability === 'file') {
            const fs = require('fs');
            const content = fs.readFileSync(msg.payload.path, 'utf8');
            return { status: 'success', content };
        }

        if (msg.capability === 'terminal') {
            const terminal = vscode.window.createTerminal('A2A');
            terminal.sendText(msg.payload.command);
            terminal.show();
            return { status: 'executed' };
        }

        return { status: 'received' };
    }

    private async sendMessage() {
        const config = vscode.workspace.getConfiguration('openclaw-a2a');
        const agents = config.get('agents', [] as any[]);

        if (agents.length === 0) {
            vscode.window.showWarningMessage('No agents configured');
            return;
        }

        const agentName = await vscode.window.showQuickPick(
            agents.map((a: any) => a.name)
        );

        const agent = agents.find((a: any) => a.name === agentName);
        if (!agent) return;

        try {
            const res = await axios.post(`${agent.url}/a2a/receive`, {
                messageId: `msg-${Date.now()}`,
                fromAgent: 'vscode-server',
                toAgent: agent.name,
                messageType: 'request',
                capability: 'ping',
                payload: {},
                timestamp: new Date().toISOString()
            });

            vscode.window.showInformationMessage(`Response: ${JSON.stringify(res.data)}`);
        } catch (err: any) {
            vscode.window.showErrorMessage(`Error: ${err.message}`);
        }
    }

    private async discover() {
        vscode.window.showInformationMessage('Discovering agents...');
    }

    private log(msg: string) {
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ${msg}`);
    }
}
