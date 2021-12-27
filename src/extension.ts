import * as vscode from 'vscode';
import { activateDiagnostic } from './diagnostic';

export function activate(context: vscode.ExtensionContext) {
	activateDiagnostic(context);
}

export function deactivate() {}
