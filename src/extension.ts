import * as vscode from 'vscode';
import { activateDiagnostic } from './diagnostic';
import { activateTranslationGeneration } from './translationGeneration';

export function activate(context: vscode.ExtensionContext) {
	activateDiagnostic(context);
	activateTranslationGeneration(context);
}

export function deactivate() {}
