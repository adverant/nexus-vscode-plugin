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
    const result = await client.recallMemory({ query, limit: 5 });

    if (result.count === 0) {
      vscode.window.showInformationMessage('No memories found');
      return;
    }

    // Show results in quick pick
    const items = result.memories.map(m => ({
      label: `$(file-code) ${m.content.substring(0, 80)}...`,
      description: `Score: ${(m.score! * 100).toFixed(1)}%`,
      detail: `Tags: ${m.tags.join(', ')} | ${m.timestamp}`,
      memory: m,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Found ${result.count} memories`,
    });

    if (selected) {
      // Show full content in new document
      const doc = await vscode.workspace.openTextDocument({
        content: selected.memory.content,
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
