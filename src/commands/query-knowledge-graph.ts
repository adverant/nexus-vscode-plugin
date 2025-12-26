import * as vscode from 'vscode';
import { QueryHandler } from '../handlers/query-handler';

export async function queryKnowledgeGraphCommand(queryHandler: QueryHandler) {
  const query = await vscode.window.showInputBox({
    prompt: 'Enter your query',
    placeHolder: 'e.g., "How does authentication work?" or "Find all database models"',
  });

  if (!query) {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Querying Knowledge Graph',
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: 'Searching codebase...' });

        const result = await queryHandler.query(query, {
          limit: 10,
        });

        // Show results in a new document
        const doc = await vscode.workspace.openTextDocument({
          content: formatQueryResults(query, result),
          language: 'markdown',
        });

        await vscode.window.showTextDocument(doc, {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside,
        });
      } catch (error) {
        vscode.window.showErrorMessage(
          `Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );
}

function formatQueryResults(query: string, result: any): string {
  let markdown = `# Query Results\n\n**Query**: ${query}\n\n`;

  if (!result.results || result.results.length === 0) {
    markdown += '_No results found._\n';
    return markdown;
  }

  markdown += `Found ${result.results.length} results:\n\n---\n\n`;

  for (const item of result.results) {
    markdown += `## ${item.entity?.name || 'Entity'}\n\n`;
    markdown += `**Type**: ${item.entity?.entityType || 'unknown'}\n\n`;
    markdown += `**Relevance**: ${(item.score * 100).toFixed(1)}%\n\n`;

    if (item.entity?.sourceFile) {
      markdown += `**File**: \`${item.entity.sourceFile}\`\n\n`;
    }

    if (item.entity?.content) {
      markdown += `\`\`\`${item.entity.language || ''}\n${item.entity.content}\n\`\`\`\n\n`;
    }

    if (item.explanation) {
      markdown += `**Explanation**: ${item.explanation}\n\n`;
    }

    markdown += `---\n\n`;
  }

  return markdown;
}
