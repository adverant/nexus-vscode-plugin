import * as vscode from 'vscode';
import { SecurityScanner } from '../tools/security-scanner';

export async function securityScanCommand() {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const repoPath = workspaceFolders[0].uri.fsPath;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Security Scan',
      cancellable: false,
    },
    async (progress) => {
      try {
        progress.report({ message: 'Scanning dependencies...' });

        const scanner = new SecurityScanner(repoPath);
        const scanResult = await scanner.scan();

        // Use reports directly instead of flattening
        const reports = scanResult.reports;

        // Show results in a new document
        const doc = await vscode.workspace.openTextDocument({
          content: formatSecurityReport(reports),
          language: 'markdown',
        });

        await vscode.window.showTextDocument(doc, {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside,
        });

        // Show summary
        if (scanResult.totalVulnerabilities > 0) {
          const criticalCount = scanResult.severityCounts.CRITICAL || 0;
          const highCount = scanResult.severityCounts.HIGH || 0;

          if (criticalCount > 0 || highCount > 0) {
            vscode.window.showWarningMessage(
              `🔒 Security Scan: Found ${criticalCount} CRITICAL and ${highCount} HIGH severity vulnerabilities`
            );
          } else {
            vscode.window.showInformationMessage(
              `🔒 Security Scan: Found ${scanResult.totalVulnerabilities} vulnerabilities (none critical)`
            );
          }
        } else {
          vscode.window.showInformationMessage(
            '✅ Security Scan: No vulnerabilities found!'
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Security scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  );
}

function formatSecurityReport(reports: any[]): string {
  let markdown = `# Security Scan Report\n\n`;
  markdown += `**Scan Date**: ${new Date().toLocaleString()}\n\n`;

  const totalVulns = reports.reduce((sum, r) => sum + r.vulnerabilities.length, 0);
  markdown += `**Total Vulnerabilities**: ${totalVulns}\n\n`;

  if (reports.length === 0 || totalVulns === 0) {
    markdown += `✅ **No vulnerabilities found!**\n`;
    return markdown;
  }

  for (const report of reports) {
    if (report.vulnerabilities.length === 0) continue;

    markdown += `## ${report.dependency.name}@${report.dependency.version}\n\n`;
    markdown += `**Ecosystem**: ${report.dependency.ecosystem}\n`;
    markdown += `**File**: \`${report.dependency.filePath}\`\n\n`;
    markdown += `### Vulnerabilities (${report.vulnerabilities.length})\n\n`;

    for (const vuln of report.vulnerabilities) {
      const emojiMap: Record<string, string> = {
        CRITICAL: '🔴',
        HIGH: '🟠',
        MEDIUM: '🟡',
        LOW: '🟢',
        UNKNOWN: '⚪',
      };
      const emoji = emojiMap[vuln.severity] || '⚪';

      markdown += `#### ${emoji} ${vuln.severity}: ${vuln.summary}\n\n`;

      if (vuln.details) {
        markdown += `**Details**: ${vuln.details}\n\n`;
      }

      if (vuln.cveIds && vuln.cveIds.length > 0) {
        markdown += `**CVEs**: ${vuln.cveIds.join(', ')}\n\n`;
      }

      if (vuln.fixedVersions && vuln.fixedVersions.length > 0) {
        markdown += `**Fixed In**: ${vuln.fixedVersions.join(', ')}\n\n`;
      }

      markdown += `---\n\n`;
    }
  }

  return markdown;
}
