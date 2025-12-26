import * as vscode from 'vscode';
import { scanDependencies } from '../tools/security-scanner';

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

        const vulnerabilities = await scanDependencies(repoPath);

        // Show results in a new document
        const doc = await vscode.workspace.openTextDocument({
          content: formatSecurityReport(vulnerabilities),
          language: 'markdown',
        });

        await vscode.window.showTextDocument(doc, {
          preview: false,
          viewColumn: vscode.ViewColumn.Beside,
        });

        // Show diagnostics for vulnerabilities
        const diagnosticCollection = vscode.languages.createDiagnosticCollection('nexus-security');
        const diagnostics: vscode.Diagnostic[] = [];

        for (const vuln of vulnerabilities) {
          const severity = vuln.severity === 'CRITICAL' || vuln.severity === 'HIGH'
            ? vscode.DiagnosticSeverity.Error
            : vuln.severity === 'MEDIUM'
            ? vscode.DiagnosticSeverity.Warning
            : vscode.DiagnosticSeverity.Information;

          const diagnostic = new vscode.Diagnostic(
            new vscode.Range(0, 0, 0, 0),
            `${vuln.package}@${vuln.version}: ${vuln.title} (${vuln.severity})`,
            severity
          );

          diagnostic.source = 'Nexus Security';
          diagnostics.push(diagnostic);
        }

        // Show summary
        const criticalCount = vulnerabilities.filter(v => v.severity === 'CRITICAL').length;
        const highCount = vulnerabilities.filter(v => v.severity === 'HIGH').length;

        if (criticalCount > 0 || highCount > 0) {
          vscode.window.showWarningMessage(
            `🔒 Security Scan: Found ${criticalCount} CRITICAL and ${highCount} HIGH severity vulnerabilities`
          );
        } else if (vulnerabilities.length > 0) {
          vscode.window.showInformationMessage(
            `🔒 Security Scan: Found ${vulnerabilities.length} vulnerabilities (none critical)`
          );
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

function formatSecurityReport(vulnerabilities: any[]): string {
  let markdown = `# Security Scan Report\n\n`;
  markdown += `**Scan Date**: ${new Date().toLocaleString()}\n\n`;
  markdown += `**Total Vulnerabilities**: ${vulnerabilities.length}\n\n`;

  if (vulnerabilities.length === 0) {
    markdown += `✅ **No vulnerabilities found!**\n`;
    return markdown;
  }

  // Group by severity
  const bySeverity = {
    CRITICAL: vulnerabilities.filter(v => v.severity === 'CRITICAL'),
    HIGH: vulnerabilities.filter(v => v.severity === 'HIGH'),
    MEDIUM: vulnerabilities.filter(v => v.severity === 'MEDIUM'),
    LOW: vulnerabilities.filter(v => v.severity === 'LOW'),
  };

  for (const [severity, vulns] of Object.entries(bySeverity)) {
    if (vulns.length === 0) continue;

    const emoji = {
      CRITICAL: '🔴',
      HIGH: '🟠',
      MEDIUM: '🟡',
      LOW: '🟢',
    }[severity];

    markdown += `## ${emoji} ${severity} Severity (${vulns.length})\n\n`;

    for (const vuln of vulns) {
      markdown += `### ${vuln.package}@${vuln.version}\n\n`;
      markdown += `**Title**: ${vuln.title}\n\n`;

      if (vuln.description) {
        markdown += `**Description**: ${vuln.description}\n\n`;
      }

      if (vuln.cve) {
        markdown += `**CVE**: ${vuln.cve}\n\n`;
      }

      if (vuln.fixedIn) {
        markdown += `**Fixed In**: ${vuln.fixedIn}\n\n`;
      }

      if (vuln.recommendation) {
        markdown += `**Recommendation**: ${vuln.recommendation}\n\n`;
      }

      markdown += `---\n\n`;
    }
  }

  return markdown;
}
