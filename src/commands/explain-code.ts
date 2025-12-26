import * as vscode from 'vscode';
import { EpisodicMemoryHandler } from '../handlers/episodic-memory';

export async function explainCodeCommand(episodicMemoryHandler: EpisodicMemoryHandler) {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText) {
    vscode.window.showErrorMessage('No code selected');
    return;
  }

  const filePath = editor.document.uri.fsPath;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Explaining Code',
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: 'Analyzing code history...' });

        const explanation = await episodicMemoryHandler.explainCode({
          filePath,
          code: selectedText,
          startLine: selection.start.line + 1,
          endLine: selection.end.line + 1,
        });

        // Show explanation in a new document
        const doc = await vscode.workspace.openTextDocument({
          content: formatExplanation(explanation),
          language: 'markdown',
        });

        await vscode.window.showTextDocument(doc, {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside,
        });
      } catch (error) {
        vscode.window.showErrorMessage(
          `Explanation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );
}

function formatExplanation(explanation: any): string {
  let markdown = `# Code Explanation\n\n`;

  // Summary
  if (explanation.summary) {
    markdown += `## Summary\n\n${explanation.summary}\n\n---\n\n`;
  }

  // Code evolution
  if (explanation.evolution && explanation.evolution.length > 0) {
    markdown += `## Evolution History\n\n`;

    for (const event of explanation.evolution) {
      markdown += `### ${event.date}\n\n`;
      markdown += `**Author**: ${event.author}\n\n`;
      markdown += `**Changes**: +${event.linesAdded} -${event.linesRemoved}\n\n`;

      if (event.message) {
        markdown += `**Commit Message**: ${event.message}\n\n`;
      }

      if (event.aiInsight) {
        markdown += `**AI Insight**: ${event.aiInsight}\n\n`;
      }

      markdown += `---\n\n`;
    }
  }

  // Related commits
  if (explanation.relatedCommits && explanation.relatedCommits.length > 0) {
    markdown += `## Related Commits\n\n`;

    for (const commit of explanation.relatedCommits) {
      markdown += `- **${commit.hash.substring(0, 7)}**: ${commit.message} (${commit.author})\n`;
    }

    markdown += `\n---\n\n`;
  }

  // Why this code exists
  if (explanation.reasoning) {
    markdown += `## Why This Code Exists\n\n${explanation.reasoning}\n\n`;
  }

  return markdown;
}
