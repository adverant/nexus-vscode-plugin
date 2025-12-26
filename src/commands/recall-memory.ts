import * as vscode from 'vscode';
import { GraphRAGClient } from '../clients/graphrag-client';

export async function recallMemoryCommand(client: GraphRAGClient, memoriesProvider: any) {
  const query = await vscode.window.showInputBox({
    prompt: 'Enter search query',
    placeHolder: 'e.g., How to implement authentication?',
  });

  if (!query) {
    return;
  }

  try {
    const results = await client.search(query, { limit: 5, domain: 'code' });

    if (results.length === 0) {
      vscode.window.showInformationMessage('No memories found');
      return;
    }

    // Show results in quick pick
    const items = results.map((result: any) => ({
      label: `$(file-code) ${result.content.substring(0, 80)}...`,
      description: `Score: ${(result.score * 100).toFixed(1)}%`,
      detail: `ID: ${result.id}`,
      content: result.content,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Found ${results.length} memories`,
    });

    if (selected) {
      // Show full content in new document
      const doc = await vscode.workspace.openTextDocument({
        content: selected.content,
        language: 'markdown',
      });
      await vscode.window.showTextDocument(doc);
    }

    // Refresh memories view
    memoriesProvider.refresh();
  } catch (error: any) {
    vscode.window.showErrorMessage(`Recall failed: ${error.message}`);
  }
}
