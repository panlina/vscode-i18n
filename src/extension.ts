import * as vscode from 'vscode';
import { activateDiagnostic } from './diagnostic';
import { activateTranslationGeneration } from './translationGeneration';
import { activateReferenceProvider } from './ReferenceProvider';

export function activate(context: vscode.ExtensionContext) {
	activateDiagnostic(context);
	activateTranslationGeneration(context);
	activateReferenceProvider(context);
}

export function deactivate() {}
