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

        const impact = await impactAnalysisHandler.analyzeImpact({
          filePath,
          entityName: extractEntityName(selectedText),
          entityType: detectEntityType(selectedText),
        });

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
        if (impact.riskLevel === 'CRITICAL' || impact.riskLevel === 'HIGH') {
          vscode.window.showWarningMessage(
            `⚠️ ${impact.riskLevel} IMPACT: This change affects ${impact.totalAffectedFiles} files!`
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

  // Risk summary
  const riskEmoji = {
    CRITICAL: '🔴',
    HIGH: '🟠',
    MEDIUM: '🟡',
    LOW: '🟢',
  }[impact.riskLevel] || '⚪';

  markdown += `## ${riskEmoji} Risk Level: ${impact.riskLevel}\n\n`;

  // Statistics
  markdown += `### Impact Statistics\n\n`;
  markdown += `- **Direct Callers**: ${impact.directCallers?.length || 0}\n`;
  markdown += `- **Total Affected Files**: ${impact.totalAffectedFiles || 0}\n`;
  markdown += `- **Max Depth**: ${impact.maxDepth || 0} levels\n`;
  markdown += `- **Impact Score**: ${impact.impactScore?.toFixed(2) || 'N/A'}\n\n`;

  if (impact.testCoverage !== undefined) {
    markdown += `- **Test Coverage**: ${(impact.testCoverage * 100).toFixed(1)}%\n\n`;
  }

  markdown += `---\n\n`;

  // Direct callers
  if (impact.directCallers && impact.directCallers.length > 0) {
    markdown += `### Direct Callers (${impact.directCallers.length})\n\n`;

    for (const caller of impact.directCallers) {
      markdown += `- **${caller.name}** in \`${caller.file}\`\n`;
      if (caller.line) {
        markdown += `  - Line ${caller.line}\n`;
      }
    }

    markdown += `\n---\n\n`;
  }

  // Affected files by depth
  if (impact.affectedFilesByDepth) {
    markdown += `### Affected Files by Depth\n\n`;

    for (const [depth, files] of Object.entries(impact.affectedFilesByDepth)) {
      markdown += `#### Depth ${depth} (${(files as any[]).length} files)\n\n`;

      for (const file of files as any[]) {
        markdown += `- \`${file}\`\n`;
      }

      markdown += `\n`;
    }

    markdown += `---\n\n`;
  }

  // Recommendations
  if (impact.recommendations && impact.recommendations.length > 0) {
    markdown += `### Recommendations\n\n`;

    for (const rec of impact.recommendations) {
      markdown += `- ${rec}\n`;
    }

    markdown += `\n`;
  }

  return markdown;
}
