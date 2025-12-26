import * as vscode from 'vscode';

export async function configureCommand(context: vscode.ExtensionContext) {
  const apiKey = await vscode.window.showInputBox({
    prompt: 'Enter your Nexus API key',
    placeHolder: 'brain_...',
    password: true,
  });

  if (apiKey) {
    await context.secrets.store('nexus-api-key', apiKey);
    vscode.window.showInformationMessage('API key saved! Please reload VSCode.');

    const reload = await vscode.window.showInformationMessage(
      'Reload VSCode to apply changes?',
      'Reload',
      'Later'
    );

    if (reload === 'Reload') {
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  }
}
