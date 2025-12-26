import * as vscode from 'vscode';
import { GraphRAGEnhancedClient } from '../clients/graphrag-enhanced-client';
import { OllamaClient } from '../clients/ollama-client';

export async function enhancedSearchCommand(
  client: GraphRAGEnhancedClient,
  ollamaClient: OllamaClient | null
) {
  const query = await vscode.window.showInputBox({
    prompt: 'Enter search query for enhanced search',
    placeHolder: 'e.g., JWT authentication implementation',
  });

  if (!query) {
    return;
  }

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Enhanced Search',
    cancellable: false,
  }, async (progress) => {
    try {
      progress.report({ message: 'Enhancing query with Qwen2.5 72B...' });

      // Optional: Use Qwen for query enhancement
      let enhancedQuery = query;
      if (ollamaClient) {
        try {
          enhancedQuery = await ollamaClient.enhanceQuery(query);
          console.log(`Query enhanced: ${query} → ${enhancedQuery}`);
        } catch {
          console.log('Qwen enhancement skipped, using original query');
        }
      }

      progress.report({ message: 'Searching with enhanced query...' });

      const result = await client.enhancedSearch({
        query: enhancedQuery,
        userId: 'vscode-user',
        sessionId: `session-${Date.now()}`,
        options: {
          enableQueryEnhancement: true,
          enableSelfCorrection: true,
          enableRAGTriadEval: true,
          topK: 10,
          returnRawScores: true,
          includeIterationTrace: true,
        },
      });

      // Show results summary
      const quality = result.quality?.overall || 0;
      const count = result.results?.length || 0;

      vscode.window.showInformationMessage(
        `Enhanced Search: Found ${count} results (Quality: ${(quality * 100).toFixed(1)}%)`
      );

      // Show detailed results in output channel
      const channel = vscode.window.createOutputChannel('Nexus Enhanced Search');
      channel.clear();
      channel.appendLine('='.repeat(80));
      channel.appendLine('Enhanced Search Results');
      channel.appendLine('='.repeat(80));
      channel.appendLine(`Original Query: ${query}`);
      channel.appendLine(`Enhanced Query: ${result.enhancement?.enhancedQuery || enhancedQuery}`);
      channel.appendLine(`Routing: ${result.enhancement?.routingDecision?.route}`);
      channel.appendLine('');
      channel.appendLine(`Quality Metrics:`);
      channel.appendLine(`  Context Relevance: ${(result.quality?.contextRelevance! * 100).toFixed(1)}%`);
      channel.appendLine(`  Groundedness: ${(result.quality?.groundedness! * 100).toFixed(1)}%`);
      channel.appendLine(`  Answer Relevance: ${(result.quality?.answerRelevance! * 100).toFixed(1)}%`);
      channel.appendLine(`  Overall: ${(quality * 100).toFixed(1)}%`);
      channel.appendLine('');
      channel.appendLine(`Results (${count}):`);
      result.results?.forEach((r, i) => {
        channel.appendLine(`  ${i + 1}. ${JSON.stringify(r).substring(0, 100)}...`);
      });
      channel.show();
    } catch (error: any) {
      vscode.window.showErrorMessage(`Enhanced search failed: ${error.message}`);
    }
  });
}
