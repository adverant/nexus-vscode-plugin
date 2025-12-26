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
      const indexer = new RepositoryIndexer(graphragClient, treeSitterService, {
        progressCallback: (indexProgress) => {
          progress.report({
            message: indexProgress.message,
            increment: indexProgress.total > 0 ? (1 / indexProgress.total) * 100 : 0,
          });
        },
      });

      try {
        const stats = await indexer.indexRepository(repoPath);

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
