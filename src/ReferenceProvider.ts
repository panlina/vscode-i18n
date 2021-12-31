import * as vscode from 'vscode';
import * as fs from 'fs';
import * as babel from '@babel/core';
import requireBabelPluginI18n from './requireBabelPluginI18n';
var FILE = requireBabelPluginI18n('FILE');
import ast from './ast';

export function activateReferenceProvider(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.languages.registerReferenceProvider(["javascript", "javascriptreact", "typescript", "typescriptreact"], new ReferenceProvider())
	);
};

class ReferenceProvider implements vscode.ReferenceProvider {
	async provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken) {
		let node: babel.Node[] = [];
		babel.traverse(ast.get(document)!, {
			enter(path) {
				if ((path.node as any).$$i18n)
					if (path.node.start! < document.offsetAt(position) && path.node.end! > document.offsetAt(position))
						node.push(path.node);
			}
		});
		return Promise.all(node.flatMap(node => {
			var { source: source, target: target } = (node as any).$$i18n;
			return Object.entries(target)
				.filter(([language, target]) => target && typeof target != 'string')	// custom translator has `typeof target == 'string'`
				.map(async ([language, target]) => {
					var [, { [FILE]: dictionary }] = target as any;
					var document = await vscode.workspace.openTextDocument(dictionary);
					var offset = fs.readFileSync(dictionary, 'utf8').indexOf(JSON.stringify(source));
					var position = document.positionAt(offset);
					return new vscode.Location(
						vscode.Uri.file(dictionary),
						position
					);
				});
		}));
	}
}
