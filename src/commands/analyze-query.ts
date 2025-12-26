import * as vscode from 'vscode';
import { GraphRAGEnhancedClient } from '../clients/graphrag-enhanced-client';

export async function analyzeQueryCommand(client: GraphRAGEnhancedClient) {
  const query = await vscode.window.showInputBox({
    prompt: 'Enter query to analyze',
    placeHolder: 'e.g., Compare PostgreSQL vs MongoDB',
  });

  if (!query) {
    return;
  }

  try {
    const result = await client.analyzeQuery({ query });

    vscode.window.showInformationMessage(
      `Query Analysis: ${result.analysis.complexity} complexity, Route: ${result.routingDecision.route}`
    );

    // Show details in output channel
    const channel = vscode.window.createOutputChannel('Nexus Query Analysis');
    channel.clear();
    channel.appendLine('='.repeat(80));
    channel.appendLine('Query Analysis');
    channel.appendLine('='.repeat(80));
    channel.appendLine(`Query: ${query}`);
    channel.appendLine('');
    channel.appendLine(`Analysis:`);
    channel.appendLine(`  Intent: ${result.analysis.intent}`);
    channel.appendLine(`  Complexity: ${result.analysis.complexity}`);
    channel.appendLine(`  Keywords: ${result.analysis.keywords.join(', ')}`);
    channel.appendLine(`  Entities: ${result.analysis.entities.join(', ')}`);
    channel.appendLine('');
    channel.appendLine(`Routing Decision:`);
    channel.appendLine(`  Route: ${result.routingDecision.route}`);
    channel.appendLine(`  Reason: ${result.routingDecision.reason}`);
    channel.appendLine(`  Confidence: ${(result.routingDecision.confidence * 100).toFixed(1)}%`);
    channel.appendLine(`  Estimated Latency: ${result.routingDecision.estimatedLatencyMs}ms`);
    channel.show();
  } catch (error: any) {
    vscode.window.showErrorMessage(`Query analysis failed: ${error.message}`);
  }
}
