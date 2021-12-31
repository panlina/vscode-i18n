import * as path from 'path';
import * as vscode from 'vscode';

export default function requireBabelPluginI18n(_path: string) {
	return require(path.join(vscode.workspace.rootPath!, 'node_modules', '@jacklu/babel-plugin-i18n', _path));
}
