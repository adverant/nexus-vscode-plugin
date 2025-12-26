import * as vscode from 'vscode';
import { GraphRAGClient } from '../clients/graphrag-client';
import { VisualizationHandler } from '../handlers/visualization-handler';
import { SecurityScanner } from '../tools/security-scanner';
import { GitService } from '../git/git-service';
import { NexusChatClient } from '../clients/nexus-chat-client';
import {
  Request,
  Response,
  RequestSchema,
  CommandSchemas,
  CommandType,
} from './types';
import { z } from 'zod';

export class MessageRouter {
  constructor(
    private _context: vscode.ExtensionContext,
    private graphRAGClient: GraphRAGClient,
    private visualizationHandler: VisualizationHandler,
    private chatClient: NexusChatClient
  ) {}

  async route(message: any): Promise<Response> {
    try {
      // Validate request structure
      const request = RequestSchema.parse(message) as Request;
      const { id, command, params } = request;

      // Validate command exists
      if (!(command in CommandSchemas)) {
        return {
          id,
          success: false,
          error: `Unknown command: ${command}`,
        };
      }

      // Validate command parameters
      const schema = CommandSchemas[command as CommandType];
      const validatedParams = schema.parse(params || {});

      // Route to appropriate handler
      let data: any;

      switch (command as CommandType) {
        case 'getDependencyGraph':
          data = await this.handleDependencyGraph(validatedParams);
          break;

        case 'getEvolutionTimeline':
          data = await this.handleEvolutionTimeline(validatedParams);
          break;

        case 'getImpactRipple':
          data = await this.handleImpactRipple(validatedParams);
          break;

        case 'getSemanticClusters':
          data = await this.handleSemanticClusters(validatedParams);
          break;

        case 'analyzeArchitecture':
          data = await this.handleArchitectureAnalyze(validatedParams);
          break;

        case 'nlQuery':
          data = await this.handleNLQuery(validatedParams);
          break;

        case 'explainCode':
          data = await this.handleExplainCode(validatedParams);
          break;

        case 'impactAnalysis':
          data = await this.handleImpactAnalysis(validatedParams);
          break;

        case 'fileHistory':
          data = await this.handleFileHistory(validatedParams);
          break;

        case 'securityScan':
          data = await this.handleSecurityScan(validatedParams);
          break;

        case 'generateTests':
          data = await this.handleGenerateTests(validatedParams);
          break;

        case 'getApiStatus':
          data = await this.handleGetApiStatus();
          break;

        case 'getRecentMemories':
          data = await this.handleGetRecentMemories(validatedParams);
          break;

        case 'getRepoStats':
          data = await this.handleGetRepoStats(validatedParams);
          break;

        case 'storeMemory':
          data = await this.handleStoreMemory(validatedParams);
          break;

        default:
          return {
            id,
            success: false,
            error: `Handler not implemented for command: ${command}`,
          };
      }

      return {
        id,
        success: true,
        data,
      };
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return {
          id: (message as any)?.id || 'unknown',
          success: false,
          error: `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
        };
      }

      // Handle other errors
      return {
        id: (message as any)?.id || 'unknown',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // Handler Methods
  // ============================================================================

  /**
   * Resolve a file path relative to the workspace
   * Tries to find the file in workspace subfolders if not found at root
   */
  private resolveFilePath(filePath: string): string {
    if (!filePath) return '';

    // If already absolute, return as-is
    if (filePath.startsWith('/')) return filePath;

    // Try to find the file in workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return filePath;
    }

    const fs = require('fs');
    const path = require('path');

    // First, try directly from workspace root
    const directPath = path.join(workspaceFolders[0].uri.fsPath, filePath);
    if (fs.existsSync(directPath)) {
      return directPath;
    }

    // If not found, try to find it in immediate subdirectories
    // This handles the case where workspace is /Users/don/Adverant but file is in nexus-vscode-plugin/src/
    const rootPath = workspaceFolders[0].uri.fsPath;
    try {
      const entries = fs.readdirSync(rootPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subPath = path.join(rootPath, entry.name, filePath);
          if (fs.existsSync(subPath)) {
            return subPath;
          }
        }
      }
    } catch {
      // Ignore errors
    }

    // Return original path if nothing found
    return filePath;
  }

  private async handleDependencyGraph(params: any) {
    const filePath = this.resolveFilePath(params.filePath);

    const result = await this.visualizationHandler.handleDependencyGraph({
      rootFile: filePath,
      layout: params.layoutAlgorithm || 'force',
      depth: params.maxDepth || 3,
    });

    if (result.content) {
      const content = result.content.find((c) => c.type === 'text');
      if (content && 'text' in content) {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Failed to generate dependency graph');
  }

  private async handleEvolutionTimeline(params: any) {
    const filePath = this.resolveFilePath(params.filePath);

    const result = await this.visualizationHandler.handleEvolutionTimeline({
      entity: filePath,
    });

    if (result.content) {
      const content = result.content.find((c) => c.type === 'text');
      if (content && 'text' in content) {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Failed to generate evolution timeline');
  }

  private async handleImpactRipple(params: any) {
    const filePath = this.resolveFilePath(params.filePath);

    const result = await this.visualizationHandler.handleImpactRipple({
      entityId: filePath,
      maxDepth: params.maxDepth || 3,
    });

    if (result.content) {
      const content = result.content.find((c) => c.type === 'text');
      if (content && 'text' in content) {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Failed to generate impact ripple');
  }

  private async handleSemanticClusters(params: any) {
    const result = await this.visualizationHandler.handleSemanticClusters({
      query: params.repositoryPath || 'all',
    });

    if (result.content) {
      const content = result.content.find((c) => c.type === 'text');
      if (content && 'text' in content) {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Failed to generate semantic clusters');
  }

  private async handleArchitectureAnalyze(params: any) {
    const result = await this.visualizationHandler.handleArchitectureAnalyze({
      targetPath: params.repositoryPath,
    });

    if (result.content) {
      const content = result.content.find((c) => c.type === 'text');
      if (content && 'text' in content) {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Failed to analyze architecture');
  }

  private async handleNLQuery(params: any) {
    const result = await this.visualizationHandler.handleNLQuery({
      query: params.query,
    });

    if (result.content) {
      const content = result.content.find((c) => c.type === 'text');
      if (content && 'text' in content) {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Failed to execute NL query');
  }

  private async handleExplainCode(params: any) {
    // Use Nexus Chat backend for intelligent code explanation
    const explanation = await this.chatClient.explainCode(
      params.code,
      params.language
    );

    return {
      explanation,
      code: params.code,
      language: params.language,
    };
  }

  private async handleImpactAnalysis(params: any) {
    // Reuse impact ripple for impact analysis
    return this.handleImpactRipple({ filePath: params.filePath, maxDepth: 5 });
  }

  private async handleFileHistory(params: any) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }

    const repoPath = workspaceFolders[0].uri.fsPath;
    const gitService = new GitService(repoPath);
    const history = await gitService.getFileHistory(params.filePath, params.maxCommits || 50);

    return {
      filePath: params.filePath,
      commits: history,
    };
  }

  private async handleSecurityScan(params: any) {
    const scanner = new SecurityScanner(params.repositoryPath);
    const result = await scanner.scan();

    return {
      totalVulnerabilities: result.totalVulnerabilities,
      severityCounts: result.severityCounts,
      reports: result.reports,
    };
  }

  private async handleGenerateTests(params: any) {
    // Use Nexus Chat backend for intelligent test generation
    const tests = await this.chatClient.generateTests(
      params.code,
      params.framework || 'Jest',
      params.language
    );

    return {
      tests,
      framework: params.framework || 'Jest',
      code: params.code,
    };
  }

  private async handleGetApiStatus() {
    try {
      // Try health check to see if API is configured
      const isHealthy = await this.graphRAGClient.healthCheck();
      return {
        configured: true,
        status: isHealthy ? 'connected' : 'disconnected',
      };
    } catch (error) {
      return {
        configured: false,
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleGetRecentMemories(params: any) {
    try {
      // Use a general query to fetch recent memories
      const results = await this.graphRAGClient.search('*', {
        limit: params.limit || 5,
        domain: 'code',
      });

      return {
        memories: results.map((r) => ({
          content: r.content,
          score: r.score,
          metadata: r.metadata,
        })),
      };
    } catch (error) {
      // If search fails, return empty array instead of throwing
      return { memories: [] };
    }
  }

  private async handleGetRepoStats(_params: any) {
    try {
      // Query GraphRAG for repository statistics
      await this.graphRAGClient.search('repository statistics', {
        limit: 1,
        domain: 'code',
      });

      // Return basic stats (in real implementation, would query Neo4j directly)
      return {
        filesIndexed: 0, // Placeholder
        entities: 0,
        relationships: 0,
        lastIndexed: new Date().toISOString(),
      };
    } catch (error) {
      return {
        filesIndexed: 0,
        entities: 0,
        relationships: 0,
        lastIndexed: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleStoreMemory(params: any) {
    const result = await this.graphRAGClient.storeEntity({
      domain: params.domain || 'code',
      entityType: params.entityType || 'memory',
      textContent: params.content,
      tags: params.tags || [],
    });

    return {
      success: true,
      entityId: result.entityId,
      message: 'Memory stored successfully',
    };
  }
}
