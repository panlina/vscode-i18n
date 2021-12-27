import * as path from 'path';
import * as vscode from 'vscode';
import * as babel from '@babel/core';
import ast from './ast';

export function activateDiagnostic(context: vscode.ExtensionContext) {
	const i18nDiagnostics = vscode.languages.createDiagnosticCollection('i18n');
	context.subscriptions.push(i18nDiagnostics);

	var fileSystemWatcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(vscode.workspace.rootPath!, "**/{i18n.*.json,*.i18n.*.json}")
	);
	fileSystemWatcher.onDidDelete(onDictionaryChange);
	fileSystemWatcher.onDidCreate(onDictionaryChange);
	fileSystemWatcher.onDidChange(onDictionaryChange);
	function onDictionaryChange(uri: vscode.Uri): void {
		var source = vscode.workspace.textDocuments.filter(
			d => (d.languageId == 'javascript' || d.languageId == 'javascriptreact' || d.languageId == 'typescript' || d.languageId == 'typescriptreact') && require(path.join(vscode.workspace.rootPath!, 'node_modules', 'babel-plugin-i18n/isTranslatedBy'))(d.fileName, uri.fsPath)
		);
		source.forEach(diagnose);
	};
	context.subscriptions.push(fileSystemWatcher);

	var activeTextEditor = vscode.window.activeTextEditor;
	if (activeTextEditor)
		if (activeTextEditor.document.uri.scheme == 'file' && (activeTextEditor.document.languageId == 'javascript' || activeTextEditor.document.languageId == 'javascriptreact' || activeTextEditor.document.languageId == 'typescript' || activeTextEditor.document.languageId == 'typescriptreact'))
			diagnose(activeTextEditor.document);
	vscode.workspace.onDidOpenTextDocument(document => {
		if (document.uri.scheme == 'file' && (document.languageId == 'javascript' || document.languageId == 'javascriptreact' || document.languageId == 'typescript' || document.languageId == 'typescriptreact'))
			diagnose(document);
	});
	vscode.workspace.onDidSaveTextDocument(document => {
		if (document.uri.scheme == 'file' && (document.languageId == 'javascript' || document.languageId == 'javascriptreact' || document.languageId == 'typescript' || document.languageId == 'typescriptreact'))
			diagnose(document);
	});
	vscode.workspace.onDidCloseTextDocument(document => {
		if (document.uri.scheme == 'file' && (document.languageId == 'javascript' || document.languageId == 'javascriptreact' || document.languageId == 'typescript' || document.languageId == 'typescriptreact'))
			i18nDiagnostics.delete(document.uri);
	});

	function diagnose(document: vscode.TextDocument) {
		try {
			var result = babel.transformFileSync(document.fileName, {
				plugins: [require(path.join(vscode.workspace.rootPath!, 'node_modules', 'babel-plugin-i18n/analyze'))],
				parserOpts: { plugins: ['jsx', 'classProperties', 'typescript'] },
				ast: true,
				code: false
			});
		} catch (e) {
			return;
		}
		if (!result) return;
		ast.set(document, result.ast);
		let node: babel.Node[] = [];
		babel.traverse(result.ast!, {
			enter(path) {
				if (
					(path.node as any).$$i18n
					&&
					Object.values((path.node as any).$$i18n.target)
						.filter(target => !target).length
				)
					node.push(path.node);
			}
		});
		let diagnostic = node.map(
			node => {
				var untranslatedLanguage =
					Object.entries((node as any).$$i18n.target)
						.filter(([language, target]) => !target)
						.map(([language, target]) => language);
				var diagnostic = new vscode.Diagnostic(
					Range(node.loc!),
					`Untranslated text for ${untranslatedLanguage.join(', ')}`,
					vscode.DiagnosticSeverity.Warning
				);
				diagnostic.code = 'untranslated-text';
				return Object.assign(diagnostic, { node: node });
			}
		);
		i18nDiagnostics.set(document.uri, diagnostic);
	}
};

type SourcePosition = babel.types.SourceLocation["start"];
function Position(loc: SourcePosition): vscode.Position {
	return new vscode.Position(loc.line - 1, loc.column);
}
function Range(location: babel.types.SourceLocation): vscode.Range {
	return new vscode.Range(Position(location.start), Position(location.end));
}
