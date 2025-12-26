/**
 * Nexus VSCode Extension
 *
 * GraphRAG-powered code intelligence with Enhanced RAG and Qwen2.5 72B integration
 */

import * as vscode from 'vscode';
import { GraphRAGClient } from './clients/graphrag-client';
import { GraphRAGEnhancedClient } from './clients/graphrag-enhanced-client';
import { OllamaClient } from './clients/ollama-client';
import { MemoriesViewProvider } from './views/memories-view-provider';
import { NexusMindViewProvider } from './views/nexusmind-view-provider';
import { storeMemoryCommand } from './commands/store-memory';
import { recallMemoryCommand } from './commands/recall-memory';
import { enhancedSearchCommand } from './commands/enhanced-search';
import { analyzeQueryCommand } from './commands/analyze-query';
import { showNexusMindCommand } from './commands/show-nexusmind';
import { configureCommand } from './commands/configure';

export async function activate(context: vscode.ExtensionContext) {
  console.log('Nexus VSCode extension is now active');

  // Get configuration
  const config = vscode.workspace.getConfiguration('nexus');
  const apiEndpoint = config.get<string>('apiEndpoint', 'https://api.adverant.ai');
  const enhancedApiEndpoint = config.get<string>('enhancedApiEndpoint', 'http://localhost:9051');
  const ollamaEndpoint = config.get<string>('ollamaEndpoint', 'http://localhost:11434');
  const enableEnhancedRAG = config.get<boolean>('enableEnhancedRAG', true);
  const enableQwen = config.get<boolean>('enableQwen', true);

  // Get API key from secrets
  let apiKey = await context.secrets.get('nexus-api-key');

  if (!apiKey) {
    // Prompt user to configure API key on first run
    vscode.window.showInformationMessage(
      'Nexus: Please configure your API key',
      'Configure'
    ).then(selection => {
      if (selection === 'Configure') {
        vscode.commands.executeCommand('nexus.configure');
      }
    });
  }

  // Initialize clients
  const graphragClient = new GraphRAGClient({
    apiEndpoint,
    apiKey: apiKey || '',
    companyId: config.get<string>('companyId', 'adverant'),
    appId: config.get<string>('appId', 'vscode-nexus'),
  });

  const enhancedClient = enableEnhancedRAG ? new GraphRAGEnhancedClient({
    apiEndpoint: enhancedApiEndpoint,
    apiKey: apiKey || '',
    companyId: config.get<string>('companyId', 'adverant'),
    appId: config.get<string>('appId', 'vscode-nexus'),
  }) : null;

  const ollamaClient = enableQwen ? new OllamaClient({
    endpoint: ollamaEndpoint,
    model: 'qwen2.5:72b',
  }) : null;

  // Store clients in context for commands to access
  context.subscriptions.push(
    { dispose: () => {} } // Placeholder for client cleanup
  );

  // Register views
  const memoriesProvider = new MemoriesViewProvider(context, graphragClient);
  const nexusMindProvider = new NexusMindViewProvider(context, graphragClient);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('nexusMemories', memoriesProvider),
    vscode.window.registerTreeDataProvider('nexusMind', nexusMindProvider)
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('nexus.storeMemory', () =>
      storeMemoryCommand(graphragClient)
    ),
    vscode.commands.registerCommand('nexus.recallMemory', () =>
      recallMemoryCommand(graphragClient, memoriesProvider)
    ),
    vscode.commands.registerCommand('nexus.enhancedSearch', () =>
      enhancedSearchCommand(enhancedClient || graphragClient, ollamaClient)
    ),
    vscode.commands.registerCommand('nexus.analyzeQuery', () =>
      analyzeQueryCommand(enhancedClient || graphragClient)
    ),
    vscode.commands.registerCommand('nexus.showNexusMind', () =>
      showNexusMindCommand(graphragClient, nexusMindProvider)
    ),
    vscode.commands.registerCommand('nexus.configure', () =>
      configureCommand(context)
    ),
    vscode.commands.registerCommand('nexus.refreshMemories', () =>
      memoriesProvider.refresh()
    )
  );

  // Auto-capture on file save if enabled
  if (config.get<boolean>('autoCapture', true)) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(async (document) => {
        // Only capture code files
        const codeExtensions = ['.ts', '.js', '.py', '.go', '.java', '.rs', '.tsx', '.jsx'];
        const ext = document.fileName.substring(document.fileName.lastIndexOf('.'));

        if (codeExtensions.includes(ext)) {
          try {
            const content = document.getText();
            const fileName = document.fileName.split('/').pop() || 'unknown';

            await graphragClient.storeMemory({
              content: `File: ${fileName}\n\n${content.substring(0, 1000)}`, // First 1000 chars
              tags: ['auto-capture', ext.substring(1), 'code'],
            });

            console.log(`Auto-captured: ${fileName}`);
          } catch (error) {
            console.error('Auto-capture failed:', error);
          }
        }
      })
    );
  }

  // Show welcome message
  vscode.window.showInformationMessage(
    `Nexus activated! ${enableEnhancedRAG ? '✨ Enhanced RAG enabled' : ''} ${enableQwen ? '🧠 Qwen2.5 72B ready' : ''}`
  );
}

export function deactivate() {
  console.log('Nexus VSCode extension is now deactivated');
}
