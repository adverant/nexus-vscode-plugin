import * as vscode from 'vscode';
import { GraphRAGClient } from '../clients/graphrag-client';

export async function storeMemoryCommand(client: GraphRAGClient) {
  const editor = vscode.window.activeTextEditor;
  let content: string | undefined;

  if (editor) {
    // Use selected text or entire file content
    const selection = editor.selection;
    content = selection.isEmpty
      ? editor.document.getText()
      : editor.document.getText(selection);
  }

  // If no editor or no content, prompt user to enter text
  if (!content || !content.trim()) {
    content = await vscode.window.showInputBox({
      prompt: 'Enter the content to store as a memory',
      placeHolder: 'Paste or type your code/text here...',
      ignoreFocusOut: true,
    });

    if (!content || !content.trim()) {
      vscode.window.showWarningMessage('No content provided. Memory not stored.');
      return;
    }
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
