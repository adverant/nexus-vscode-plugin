// src/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import pino from 'pino';
import type { NexusConfig, AuthContext } from './types.js';
import { GraphRAGClient } from './clients/graphrag-client.js';
import { MageAgentClient } from './clients/mageagent-client.js';
import { TreeSitterService } from './parsers/tree-sitter-service.js';
import { GitService } from './git/git-service.js';
import {
  VisualizationHandler,
  VISUALIZATION_TOOLS,
  createVisualizationHandler,
} from './handlers/index.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Interface for MCP Server to enable dependency injection and testing.
 * This allows us to inject mock servers for testing without ESM module mocking.
 */
export interface MCPServer {
  setRequestHandler: (schema: unknown, handler: (request: any) => Promise<any>) => void;
  connect: (transport: unknown) => Promise<void>;
  close?: () => Promise<void>;
}

/**
 * Factory function type for creating MCP servers.
 * Used for dependency injection in testing.
 */
export type MCPServerFactory = (
  serverInfo: { name: string; version: string },
  options: { capabilities: { tools: Record<string, unknown> } }
) => MCPServer;

/**
 * Default server factory using the real MCP SDK Server.
 */
export const defaultServerFactory: MCPServerFactory = (serverInfo, options) => {
  return new Server(serverInfo, options) as MCPServer;
};

export class NexusCursorServer {
  private server: MCPServer;
  private config: NexusConfig;
  private authContext: AuthContext | null = null;
  private initialized = false;

  // Service instances
  private graphRAGClient: GraphRAGClient | null = null;
  private mageAgentClient: MageAgentClient | null = null;
  private treeSitterService: TreeSitterService | null = null;
  private gitService: GitService | null = null;
  private visualizationHandler: VisualizationHandler | null = null;

  constructor(config: NexusConfig, serverFactory: MCPServerFactory = defaultServerFactory) {
    this.config = config;
    this.server = serverFactory(
      {
        name: 'nexus-cursor-plugin',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Initialize services lazily when needed
   */
  private async initializeServices(repoPath: string): Promise<void> {
    if (this.visualizationHandler) {
      return; // Already initialized
    }

    // Initialize GraphRAG client
    this.graphRAGClient = new GraphRAGClient(
      this.config.endpoint,
      this.config.apiKey
    );

    // Initialize MageAgent client (optional)
    try {
      this.mageAgentClient = new MageAgentClient(
        this.config.endpoint,
        this.config.apiKey
      );
    } catch {
      logger.warn('MageAgent client initialization failed, AI features may be limited');
      this.mageAgentClient = null;
    }

    // Initialize Tree-sitter service
    this.treeSitterService = new TreeSitterService();

    // Initialize Git service
    this.gitService = new GitService(repoPath);

    // Initialize visualization handler
    this.visualizationHandler = createVisualizationHandler(
      this.graphRAGClient,
      this.mageAgentClient,
      this.treeSitterService,
      this.gitService,
      repoPath
    );

    logger.info({ repoPath }, 'Services initialized');
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getToolDefinitions(),
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Ensure authenticated before any tool call
        if (!this.authContext) {
          await this.authenticate();
        }

        return await this.executeTool(name, args);
      } catch (error) {
        logger.error({ error, tool: name }, 'Tool execution failed');
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private getToolDefinitions() {
    // Core tools
    const coreTools = [
      {
        name: 'nexus_health',
        description: 'Check connection to Nexus backend services',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'nexus_index_repository',
        description: 'Index the current repository for code intelligence',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Repository path (defaults to workspace root)',
            },
          },
          required: [],
        },
      },
      {
        name: 'nexus_query',
        description: 'Query the code knowledge graph with natural language',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Natural language question about the codebase',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'nexus_explain_code',
        description: 'Explain a code block with historical context',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the file',
            },
            startLine: {
              type: 'number',
              description: 'Start line number',
            },
            endLine: {
              type: 'number',
              description: 'End line number',
            },
          },
          required: ['filePath', 'startLine', 'endLine'],
        },
      },
      {
        name: 'nexus_impact_analysis',
        description: 'Analyze impact of changing a function or class',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Function or class name to analyze',
            },
            filePath: {
              type: 'string',
              description: 'File containing the symbol',
            },
          },
          required: ['symbol'],
        },
      },
      {
        name: 'nexus_file_history',
        description: 'Get commit history and evolution of a file',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the file',
            },
            limit: {
              type: 'number',
              description: 'Maximum commits to return (default 10)',
            },
          },
          required: ['filePath'],
        },
      },
    ];

    // Combine core tools with visualization tools
    return [...coreTools, ...VISUALIZATION_TOOLS];
  }

  private async authenticate(): Promise<void> {
    logger.info('Authenticating with Nexus backend...');

    const response = await fetch(`${this.config.endpoint}/internal/plugins/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
      },
      body: JSON.stringify({
        plugin_id: 'cursor-ide',
        plugin_name: 'Nexus Cursor Plugin',
        api_key: this.config.apiKey,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Authentication failed: ${error}`);
    }

    const data = await response.json() as {
      authorized: boolean;
      user_id: string;
      email?: string;
      tier: string;
      organization_id?: string;
      permissions?: string[];
      rate_limit?: number;
      quotas?: {
        tokens_per_month?: number;
      };
    };

    if (!data.authorized) {
      throw new Error('API key not authorized for Cursor plugin');
    }

    this.authContext = {
      userId: data.user_id,
      email: data.email || '',
      tier: data.tier,
      organizationId: data.organization_id,
      permissions: data.permissions || [],
      quotas: {
        requestsPerMinute: data.rate_limit || 60,
        tokensPerMonth: data.quotas?.tokens_per_month || 100000,
      },
    };

    logger.info({ userId: this.authContext.userId, tier: this.authContext.tier },
      'Authentication successful');
  }

  private async executeTool(name: string, args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    // Handle core tools
    switch (name) {
      case 'nexus_health':
        return this.handleHealth();

      case 'nexus_index_repository':
        return this.handleIndexRepository(args as { path?: string });

      case 'nexus_query':
        return this.handleQuery(args as { query: string });

      case 'nexus_explain_code':
        return this.handleExplainCode(args as { filePath: string; startLine: number; endLine: number });

      case 'nexus_impact_analysis':
        return this.handleImpactAnalysis(args as { symbol: string; filePath?: string });

      case 'nexus_file_history':
        return this.handleFileHistory(args as { filePath: string; limit?: number });
    }

    // Handle visualization tools (nexusmind_* prefix)
    if (name.startsWith('nexusmind_')) {
      return this.handleVisualizationTool(name, args);
    }

    throw new Error(`Unknown tool: ${name}`);
  }

  /**
   * Handle visualization tool calls
   */
  private async handleVisualizationTool(
    name: string,
    args: unknown
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    // Ensure services are initialized
    const repoPath = process.cwd(); // Use current working directory
    await this.initializeServices(repoPath);

    if (!this.visualizationHandler) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: false, error: 'Visualization handler not initialized' }),
          },
        ],
      };
    }

    switch (name) {
      case 'nexusmind_dependency_graph':
        return this.visualizationHandler.handleDependencyGraph(
          args as {
            rootFile: string;
            depth?: number;
            layout?: 'force' | 'hierarchical' | 'radial' | 'organic';
            nodeTypes?: string[];
            edgeTypes?: string[];
            includeExternal?: boolean;
          }
        );

      case 'nexusmind_evolution_timeline':
        return this.visualizationHandler.handleEvolutionTimeline(
          args as {
            entity: string;
            startDate?: string;
            endDate?: string;
            granularity?: string;
            showAuthors?: boolean;
          }
        );

      case 'nexusmind_impact_ripple':
        return this.visualizationHandler.handleImpactRipple(
          args as {
            entityId: string;
            maxDepth?: number;
            includeTests?: boolean;
            minimumImpactScore?: number;
          }
        );

      case 'nexusmind_semantic_clusters':
        return this.visualizationHandler.handleSemanticClusters(
          args as {
            query?: string;
            algorithm?: string;
            numClusters?: number;
            minClusterSize?: number;
            excludeTests?: boolean;
          }
        );

      case 'nexusmind_architecture_analyze':
        return this.visualizationHandler.handleArchitectureAnalyze(
          args as {
            targetPath?: string;
            issueTypes?: string[];
            minConfidence?: number;
            includeRefactoringSuggestions?: boolean;
          }
        );

      case 'nexusmind_nl_query':
        return this.visualizationHandler.handleNLQuery(
          args as {
            query: string;
            selectedNodes?: string[];
          }
        );

      default:
        throw new Error(`Unknown visualization tool: ${name}`);
    }
  }

  private async handleHealth() {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            status: 'healthy',
            authenticated: !!this.authContext,
            user: this.authContext?.email,
            tier: this.authContext?.tier,
            endpoint: this.config.endpoint,
          }, null, 2),
        },
      ],
    };
  }

  private async handleIndexRepository(args: { path?: string }) {
    // TODO: Implement in Phase 2
    return {
      content: [{ type: 'text', text: 'Repository indexing not yet implemented' }],
    };
  }

  private async handleQuery(args: { query: string }) {
    // TODO: Implement in Phase 3
    return {
      content: [{ type: 'text', text: `Query received: ${args.query}\nGraphRAG integration pending.` }],
    };
  }

  private async handleExplainCode(args: { filePath: string; startLine: number; endLine: number }) {
    // TODO: Implement in Phase 3
    return {
      content: [{ type: 'text', text: 'Code explanation not yet implemented' }],
    };
  }

  private async handleImpactAnalysis(args: { symbol: string; filePath?: string }) {
    // TODO: Implement in Phase 3
    return {
      content: [{ type: 'text', text: `Impact analysis for ${args.symbol} not yet implemented` }],
    };
  }

  private async handleFileHistory(args: { filePath: string; limit?: number }) {
    // TODO: Implement in Phase 2
    return {
      content: [{ type: 'text', text: 'File history not yet implemented' }],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Nexus Cursor MCP Server running on stdio');
  }
}
