import * as vscode from 'vscode';
import { GraphRAGClient } from '../clients/graphrag-client';
import { TreeSitterService } from '../parsers/tree-sitter-service';
import { RepositoryIndexer } from '../indexer/repository-indexer';

export async function indexRepositoryCommand(
  graphragClient: GraphRAGClient,
  treeSitterService: TreeSitterService
) {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const repoPath = workspaceFolders[0].uri.fsPath;

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Indexing Repository',
      cancellable: true,
    },
    async (progress, token) => {
      const indexer = new RepositoryIndexer(graphragClient, treeSitterService);

      let filesProcessed = 0;

      try {
        const stats = await indexer.indexRepository(repoPath, {
          onProgress: (current, total) => {
            filesProcessed = current;
            progress.report({
              message: `Processing file ${current} of ${total}`,
              increment: (1 / total) * 100,
            });
          },
          signal: token,
        });

        vscode.window.showInformationMessage(
          `Repository indexed successfully!\n` +
          `Files: ${stats.filesProcessed}, ` +
          `Entities: ${stats.entitiesCreated}, ` +
          `Relationships: ${stats.relationshipsCreated}`
        );
      } catch (error) {
        if (token.isCancellationRequested) {
          vscode.window.showWarningMessage('Repository indexing cancelled');
        } else {
          vscode.window.showErrorMessage(`Indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
  );
}
