import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as detectIndent from 'detect-indent';

export function activateTranslationGeneration(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('i18n.generateTranslation', async (document: vscode.TextDocument, diagnostic: vscode.Diagnostic, language: string) => {
			if (!fs.existsSync(`${document.fileName}.i18n.${language}.json`))
				fs.writeFileSync(`${document.fileName}.i18n.${language}.json`, "{\n}", 'utf8');
			var source = (diagnostic as any).node.$$i18n.source;
			var edit = new vscode.WorkspaceEdit();
			var translationDocument = await vscode.workspace.openTextDocument(`${document.fileName}.i18n.${language}.json`);
			var text = translationDocument.getText();
			var indentation = detectIndent(text);
			if (text.lastIndexOf('"') != -1) {
				var position = translationDocument.positionAt(text.lastIndexOf('"') + 1);
				var newText = `,\n${indentation.indent}${JSON.stringify(source)}: ${JSON.stringify(source)}`;
			}
			else {
				var position = new vscode.Position(1, 0);
				var newText = `${indentation.indent}${JSON.stringify(source)}: ${JSON.stringify(source)}\n`;
			}
			edit.insert(vscode.Uri.file(`${document.fileName}.i18n.${language}.json`), position, newText);
			await vscode.workspace.applyEdit(edit);
			var editor = await vscode.window.showTextDocument(translationDocument);
			var startPosition = new vscode.Position(translationDocument.lineCount - 2, `${indentation.indent}${JSON.stringify(source)}: "`.length);
			editor.selection = new vscode.Selection(startPosition, startPosition.translate(0, JSON.stringify(source).length));
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('i18n.generateDictionary', (document: vscode.TextDocument, language: string) => {
			require(path.join(vscode.workspace.rootPath!, 'node_modules', 'babel-plugin-i18n/updateDictionary'))(document.fileName, language);
			vscode.window.showTextDocument(vscode.Uri.file(`${document.fileName}.i18n.${language}.json`));
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('i18n.explorer.generateDictionary', async (_, files: vscode.Uri[]) => {
			var config = require(path.join(vscode.workspace.rootPath!, "i18n.config.js"));
			var languages = Object.keys(config.translator).filter(language => config.translator[language] == 'dictionary');
			var language = await vscode.window.showQuickPick(languages, { placeHolder: "Language" });
			if (!language) return;
			for (var file of files)
				require(path.join(vscode.workspace.rootPath!, 'node_modules', 'babel-plugin-i18n/updateDictionary'))(file.path, language);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('i18n.explorer.generateReport', async (file: vscode.Uri) => {
			var config = require(path.join(vscode.workspace.rootPath!, "i18n.config.js"));
			var languages = Object.keys(config.translator).filter(language => config.translator[language] == 'dictionary');
			var language = await vscode.window.showQuickPick(languages, { placeHolder: "Language" });
			if (!language) return;
			var [m, n] = require(path.join(vscode.workspace.rootPath!, 'node_modules', 'babel-plugin-i18n/getStat'))(file.path, language);
			vscode.window.showInformationMessage(`${m}/${n} entries translated. Coverage: ${(m / n * 100).toFixed(2)}%.`);
		})
	);

	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider(['javascript', 'javascriptreact', 'typescript', 'typescriptreact'], new TranslationProvider(), {
			providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
		})
	);
};

class TranslationProvider implements vscode.CodeActionProvider {
	provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.CodeAction[] {
		var codeActions = context.diagnostics
			.filter(diagnostic => diagnostic.code === 'untranslated-text')
			.flatMap(diagnostic => this.createGenerateTranslationCodeActions(document, diagnostic));
		if (context.diagnostics.length)
			codeActions.push(...context.diagnostics
				.filter(diagnostic => diagnostic.code === 'untranslated-text')
				.flatMap(diagnostic => this.createGenerateDictionaryCodeActions(document, diagnostic))
			);
		return codeActions;
	}

	private createGenerateTranslationCodeActions(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction[] {
		var start = document.offsetAt(diagnostic.range.start),
			end = document.offsetAt(diagnostic.range.end);
		var preview = document.getText().substr(start, end - start);
		var actions: vscode.CodeAction[] = [];
		for (var [language, target] of Object.entries((diagnostic as any).node.$$i18n.target)) {
			if (target) continue;
			var action = new vscode.CodeAction(`Generate ${language} translation for "${preview}"`, vscode.CodeActionKind.QuickFix);
			action.command = {
				title: "Generate Translation",
				command: "i18n.generateTranslation",
				arguments: [document, diagnostic, language]
			};
			action.diagnostics = [diagnostic];
			actions.push(action);
		}
		return actions;
	}

	private createGenerateDictionaryCodeActions(document: vscode.TextDocument, diagnostic: vscode.Diagnostic) {
		var actions: vscode.CodeAction[] = [];
		for (var [language, target] of Object.entries((diagnostic as any).node.$$i18n.target)) {
			if (target) continue;
			var title = fs.existsSync(`${document.fileName}.i18n.${language}.json`) ?
				`Regenerate ${language} dictionary for this file"` :
				`Generate ${language} dictionary for this file`;
			var action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
			action.command = {
				title: "Generate Dictionary",
				command: "i18n.generateDictionary",
				arguments: [document, language]
			};
			actions.push(action);
		}
		return actions;
	}
}
