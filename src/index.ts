import * as vscode from 'vscode';
import { OpenClawA2A } from './extension';

let a2a: OpenClawA2A;

export function activate(context: vscode.ExtensionContext) {
    a2a = new OpenClawA2A(context);
    a2a.activate();
}

export function deactivate() {
    a2a?.deactivate();
}
