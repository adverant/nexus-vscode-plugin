import * as vscode from 'vscode';
import { GitService } from '../git/git-service';

export async function fileHistoryCommand(gitService: GitService) {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const filePath = editor.document.uri.fsPath;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);

  if (!workspaceFolder) {
    vscode.window.showErrorMessage('File is not in a workspace');
    return;
  }

  const repoPath = workspaceFolder.uri.fsPath;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Loading File History',
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: 'Fetching git history...' });

        const history = await gitService.getFileHistory(repoPath, filePath, 50);

        // Show history in a new document
        const doc = await vscode.workspace.openTextDocument({
          content: formatFileHistory(filePath, history),
          language: 'markdown',
        });

        await vscode.window.showTextDocument(doc, {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside,
        });
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to load file history: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );
}

function formatFileHistory(filePath: string, history: any[]): string {
  const fileName = filePath.split('/').pop() || filePath;

  let markdown = `# File History: ${fileName}\n\n`;
  markdown += `**Path**: \`${filePath}\`\n\n`;
  markdown += `**Total Commits**: ${history.length}\n\n`;
  markdown += `---\n\n`;

  if (history.length === 0) {
    markdown += '_No commit history found._\n';
    return markdown;
  }

  // Group by month
  const byMonth: Record<string, any[]> = {};

  for (const commit of history) {
    const date = new Date(commit.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!byMonth[monthKey]) {
      byMonth[monthKey] = [];
    }

    byMonth[monthKey].push(commit);
  }

  // Format by month
  for (const [monthKey, commits] of Object.entries(byMonth)) {
    const [year, month] = monthKey.split('-');
    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long' });

    markdown += `## ${monthName} ${year} (${commits.length} commits)\n\n`;

    for (const commit of commits) {
      const date = new Date(commit.date).toLocaleDateString();
      const hash = commit.hash.substring(0, 7);

      markdown += `### ${date} - \`${hash}\`\n\n`;
      markdown += `**Author**: ${commit.author}\n\n`;
      markdown += `**Message**: ${commit.message}\n\n`;

      if (commit.stats) {
        markdown += `**Changes**: +${commit.stats.insertions || 0} -${commit.stats.deletions || 0}\n\n`;
      }

      if (commit.files) {
        markdown += `**Files Changed**: ${commit.files.length}\n\n`;
      }

      markdown += `---\n\n`;
    }
  }

  return markdown;
}
