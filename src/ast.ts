import * as vscode from 'vscode';
export default new Map<vscode.TextDocument, babel.types.File | null | undefined>();
