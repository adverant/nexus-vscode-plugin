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

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export class NexusCursorServer {
  private server: Server;
  private config: NexusConfig;
  private authContext: AuthContext | null = null;
  private initialized = false;

  constructor(config: NexusConfig) {
    this.config = config;
    this.server = new Server(
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
    return [
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

      default:
        throw new Error(`Unknown tool: ${name}`);
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
