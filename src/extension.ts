/**
 * Nexus VSCode Extension
 *
 * GraphRAG-powered code intelligence for VSCode
 */

import * as vscode from 'vscode';
import { GraphRAGClient } from './clients/graphrag-client';
import { NexusChatClient } from './clients/nexus-chat-client';
import { MageAgentClient } from './clients/mageagent-client';
import { SubscriptionClient } from './clients/subscription-client';
import { FileProcessClient } from './clients/fileprocess-client';
import { TreeSitterService } from './parsers/tree-sitter-service';
import { GitService } from './git/git-service';
import { MemoriesViewProvider } from './views/memories-view-provider';
import { NexusMindViewProvider } from './views/nexusmind-view-provider';
import { EpisodicMemoryHandler } from './handlers/episodic-memory';
import { ImpactAnalysisHandler } from './handlers/impact-analysis';
import { QueryHandler } from './handlers/query-handler';
import { VisualizationHandler } from './handlers/visualization-handler';
import { storeMemoryCommand } from './commands/store-memory';
import { recallMemoryCommand } from './commands/recall-memory';
import { showNexusMindCommand } from './commands/show-nexusmind';
import { configureCommand } from './commands/configure';
import { indexRepositoryCommand } from './commands/index-repository';
import { queryKnowledgeGraphCommand } from './commands/query-knowledge-graph';
import { explainCodeCommand } from './commands/explain-code';
import { impactAnalysisCommand } from './commands/impact-analysis';
import { fileHistoryCommand } from './commands/file-history';
import { securityScanCommand } from './commands/security-scan';
import { generateTestsCommand } from './commands/generate-tests';
import {
  dependencyGraphCommand,
  evolutionTimelineCommand,
  impactRippleCommand,
  semanticClustersCommand,
  architectureAnalyzeCommand,
  nlQueryCommand
} from './commands/nexusmind-visualizations';
import { WebViewPanelManager } from './webview/WebViewPanelManager';
import { MessageRouter } from './webview/MessageRouter';

export async function activate(context: vscode.ExtensionContext) {
  console.log('Nexus VSCode extension is now active');

  // Get configuration
  const config = vscode.workspace.getConfiguration('nexus');
  const apiEndpoint = config.get<string>('apiEndpoint', 'https://api.adverant.ai');
  const mageAgentEndpoint = config.get<string>('mageAgentEndpoint', 'https://api.adverant.ai');
  const companyId = config.get<string>('companyId', 'adverant');
  const appId = config.get<string>('appId', 'nexus-vscode');

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

  // Get workspace folder context first
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const repoPath = workspaceFolders && workspaceFolders.length > 0
    ? workspaceFolders[0].uri.fsPath
    : '';

  // Initialize clients
  const graphragClient = new GraphRAGClient(apiEndpoint, apiKey || '', companyId, appId);
  const chatClient = new NexusChatClient(apiEndpoint, apiKey || '');
  const mageAgentClient = new MageAgentClient(mageAgentEndpoint, apiKey || ''); // Keep for VisualizationHandler compatibility
  const subscriptionClient = new SubscriptionClient(apiEndpoint, apiKey || '', companyId);
  const fileProcessClient = new FileProcessClient(
    apiEndpoint,
    apiEndpoint.replace('https://', 'wss://').replace('http://', 'ws://'),
    apiKey || '',
    companyId,
    appId
  );

  // Initialize services
  const treeSitterService = new TreeSitterService();
  const gitService = new GitService(repoPath);

  // Initialize handlers
  const episodicMemoryHandler = new EpisodicMemoryHandler(gitService, graphragClient, treeSitterService, repoPath);
  const queryHandler = new QueryHandler(graphragClient);
  const impactAnalysisHandler = new ImpactAnalysisHandler(graphragClient, treeSitterService, repoPath);
  const visualizationHandler = new VisualizationHandler(graphragClient, mageAgentClient, treeSitterService, gitService, repoPath);

  // Initialize WebView Panel Manager with chat client for intelligent routing
  const messageRouter = new MessageRouter(context, graphragClient, visualizationHandler, chatClient);
  messageRouter.setSubscriptionClient(subscriptionClient);
  messageRouter.setFileProcessClient(fileProcessClient);
  WebViewPanelManager.initialize(context, messageRouter);

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
    // Core memory commands
    vscode.commands.registerCommand('nexus.storeMemory', () =>
      storeMemoryCommand(graphragClient)
    ),
    vscode.commands.registerCommand('nexus.recallMemory', () =>
      recallMemoryCommand(graphragClient, memoriesProvider)
    ),

    // Configuration
    vscode.commands.registerCommand('nexus.configure', () =>
      configureCommand(context)
    ),

    // Repository operations
    vscode.commands.registerCommand('nexus.indexRepository', () =>
      indexRepositoryCommand(graphragClient, treeSitterService)
    ),
    vscode.commands.registerCommand('nexus.queryKnowledgeGraph', () =>
      queryKnowledgeGraphCommand(queryHandler)
    ),

    // Code intelligence
    vscode.commands.registerCommand('nexus.explainCode', () =>
      explainCodeCommand(episodicMemoryHandler)
    ),
    vscode.commands.registerCommand('nexus.impactAnalysis', () =>
      impactAnalysisCommand(impactAnalysisHandler)
    ),
    vscode.commands.registerCommand('nexus.fileHistory', () =>
      fileHistoryCommand(gitService)
    ),

    // Security and testing
    vscode.commands.registerCommand('nexus.securityScan', () =>
      securityScanCommand()
    ),
    vscode.commands.registerCommand('nexus.generateTests', () =>
      generateTestsCommand()
    ),

    // NexusMind visualizations
    vscode.commands.registerCommand('nexus.dependencyGraph', () =>
      dependencyGraphCommand(visualizationHandler)
    ),
    vscode.commands.registerCommand('nexus.evolutionTimeline', () =>
      evolutionTimelineCommand(visualizationHandler)
    ),
    vscode.commands.registerCommand('nexus.impactRipple', () =>
      impactRippleCommand(visualizationHandler)
    ),
    vscode.commands.registerCommand('nexus.semanticClusters', () =>
      semanticClustersCommand(visualizationHandler)
    ),
    vscode.commands.registerCommand('nexus.architectureAnalyze', () =>
      architectureAnalyzeCommand(visualizationHandler)
    ),
    vscode.commands.registerCommand('nexus.nlQuery', () =>
      nlQueryCommand(visualizationHandler)
    ),

    // Views
    vscode.commands.registerCommand('nexus.showNexusMind', () =>
      showNexusMindCommand(graphragClient, nexusMindProvider)
    ),
    vscode.commands.registerCommand('nexus.refreshMemories', () =>
      memoriesProvider.refresh()
    ),
    vscode.commands.registerCommand('nexus.viewMemory', async (result: any) => {
      const doc = await vscode.workspace.openTextDocument({
        content: result.content,
        language: 'markdown',
      });
      await vscode.window.showTextDocument(doc);
    }),

    // WebView Panel
    vscode.commands.registerCommand('nexus.openPanel', () => {
      WebViewPanelManager.getInstance().show();
    })
  );

  // Auto-index on file save if enabled
  if (config.get<boolean>('autoIndex', false)) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(async (document) => {
        // Only index code files
        const codeExtensions = ['.ts', '.js', '.py', '.go', '.java', '.rs', '.tsx', '.jsx'];
        const ext = document.fileName.substring(document.fileName.lastIndexOf('.'));

        if (codeExtensions.includes(ext)) {
          try {
            const content = document.getText();
            const fileName = document.fileName.split('/').pop() || 'unknown';

            await graphragClient.storeEntity({
              domain: 'code',
              entityType: 'file',
              textContent: `File: ${fileName}\n\n${content.substring(0, 1000)}`,
              tags: ['auto-index', ext.substring(1), 'code'],
            });

            console.log(`Auto-indexed: ${fileName}`);
          } catch (error) {
            console.error('Auto-index failed:', error);
          }
        }
      })
    );
  }

  // Show welcome message
  vscode.window.showInformationMessage('Nexus activated! GraphRAG code intelligence ready 🚀');
}

export function deactivate() {
  console.log('Nexus VSCode extension is now deactivated');
}
