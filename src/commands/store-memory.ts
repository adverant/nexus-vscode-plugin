import * as vscode from 'vscode';
import { GraphRAGClient } from '../clients/graphrag-client';

export async function storeMemoryCommand(client: GraphRAGClient) {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const selection = editor.selection;
  const content = selection.isEmpty
    ? editor.document.getText()
    : editor.document.getText(selection);

  if (!content.trim()) {
    vscode.window.showErrorMessage('No content to store');
    return;
  }

  const tags = await vscode.window.showInputBox({
    prompt: 'Enter tags (comma-separated)',
    placeHolder: 'e.g., typescript, authentication, api',
  });

  try {
    const result = await client.storeEntity({
      domain: 'code',
      entityType: 'memory',
      textContent: content,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
    });

    vscode.window.showInformationMessage(
      `Memory stored successfully! ID: ${result.entityId.substring(0, 8)}...`
    );
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to store memory: ${error.message}`);
  }
}
