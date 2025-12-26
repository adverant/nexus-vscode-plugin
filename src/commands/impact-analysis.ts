import * as vscode from 'vscode';
import { ImpactAnalysisHandler } from '../handlers/impact-analysis';

export async function impactAnalysisCommand(impactAnalysisHandler: ImpactAnalysisHandler) {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText) {
    vscode.window.showErrorMessage('No code selected. Please select a function or class.');
    return;
  }

  const filePath = editor.document.uri.fsPath;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Analyzing Impact',
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: 'Analyzing dependencies...' });

        const entityName = extractEntityName(selectedText);
        const impact = await impactAnalysisHandler.analyzeImpact(entityName, filePath);

        // Show impact in a new document
        const doc = await vscode.workspace.openTextDocument({
          content: formatImpactAnalysis(impact),
          language: 'markdown',
        });

        await vscode.window.showTextDocument(doc, {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside,
        });

        // Also show diagnostic warnings for high-impact changes
        const highImpactItems = impact.impacts.filter(
          (item: any) => item.impactLevel === 'CRITICAL' || item.impactLevel === 'HIGH'
        );
        if (highImpactItems.length > 0) {
          vscode.window.showWarningMessage(
            `⚠️ HIGH IMPACT: This change affects ${impact.impacts.length} locations!`
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Impact analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );
}

function extractEntityName(code: string): string {
  // Simple heuristic to extract function/class name
  const functionMatch = code.match(/(?:function|const|let|var)\s+(\w+)/);
  if (functionMatch) return functionMatch[1];

  const classMatch = code.match(/class\s+(\w+)/);
  if (classMatch) return classMatch[1];

  return 'unknown';
}

function detectEntityType(code: string): string {
  if (code.includes('class ')) return 'class';
  if (code.includes('function ') || code.includes('=>')) return 'function';
  if (code.includes('interface ')) return 'interface';
  if (code.includes('type ')) return 'type';
  return 'unknown';
}

function formatImpactAnalysis(impact: any): string {
  let markdown = `# Impact Analysis\n\n`;
  markdown += `**Target**: ${impact.targetSymbol} in \`${impact.targetFile}\`\n\n`;

  // Statistics
  markdown += `### Impact Statistics\n\n`;
  markdown += `- **Total Impact Score**: ${impact.totalImpact.toFixed(2)}\n`;
  markdown += `- **Affected Locations**: ${impact.impacts.length}\n`;
  markdown += `- **Graph Depth**: ${impact.graphDepth} levels\n\n`;
  markdown += `---\n\n`;

  // Group impacts by level
  const byLevel: Record<string, any[]> = {
    CRITICAL: [],
    HIGH: [],
    MEDIUM: [],
    LOW: [],
  };

  for (const item of impact.impacts) {
    byLevel[item.impactLevel].push(item);
  }

  for (const [level, items] of Object.entries(byLevel)) {
    if (items.length === 0) continue;

    const emoji = {
      CRITICAL: '🔴',
      HIGH: '🟠',
      MEDIUM: '🟡',
      LOW: '🟢',
    }[level] || '⚪';

    markdown += `## ${emoji} ${level} Impact (${items.length})\n\n`;

    for (const item of items) {
      markdown += `### ${item.symbol} in \`${item.filePath}\`\n\n`;
      markdown += `- **Impact Score**: ${item.impactScore}\n`;
      markdown += `- **Depth**: ${item.depth}\n`;
      markdown += `- **Usages**: ${item.usages.length}\n`;
      markdown += `- **Reason**: ${item.reason}\n\n`;
    }

    markdown += `---\n\n`;
  }

  return markdown;
}
