import * as vscode from 'vscode';
import { GraphRAGClient } from '../clients/graphrag-client';
import { VisualizationHandler } from '../handlers/visualization-handler';
import { SecurityScanner } from '../tools/security-scanner';
import { GitService } from '../git/git-service';
import { MageAgentClient } from '../clients/mageagent-client';
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
    private context: vscode.ExtensionContext,
    private graphRAGClient: GraphRAGClient,
    private visualizationHandler: VisualizationHandler,
    private mageAgentClient: MageAgentClient
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

  private async handleDependencyGraph(params: any) {
    const result = await this.visualizationHandler.handleDependencyGraph({
      rootFile: params.filePath,
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
    const result = await this.visualizationHandler.handleEvolutionTimeline({
      entity: params.filePath,
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
    const result = await this.visualizationHandler.handleImpactRipple({
      entityId: params.filePath,
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
    // Use MageAgent to explain code
    const job = await this.mageAgentClient.orchestrate(
      `Explain the following code in detail:\n\n${params.code}`
    );

    // Wait for completion
    const result = await this.mageAgentClient.waitForCompletion(job.jobId);

    return {
      explanation: result.result || 'Unable to generate explanation',
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
    const job = await this.mageAgentClient.orchestrate(
      `Generate comprehensive unit tests for this code using ${params.framework || 'Jest'}:\n\n${params.code}`
    );

    // Wait for completion
    const result = await this.mageAgentClient.waitForCompletion(job.jobId);

    return {
      tests: result.result || 'Unable to generate tests',
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
    const results = await this.graphRAGClient.search('', {
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
  }

  private async handleGetRepoStats(params: any) {
    try {
      // Query GraphRAG for repository statistics
      const results = await this.graphRAGClient.search('repository statistics', {
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
}
