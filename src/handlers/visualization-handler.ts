// src/handlers/visualization-handler.ts
/**
 * NexusMind Visualization Handler
 *
 * MCP tool handler for all visualization-related operations.
 * Provides tools for dependency graphs, evolution timelines,
 * impact analysis, semantic clustering, and more.
 */

import {
  DependencyGraphBuilder,
  EvolutionTimelineBuilder,
  ImpactRippleBuilder,
  SemanticClusteringEngine,
  ArchitectureAdvisor,
  NLGraphQueryProcessor,
  createDefaultFilters,
  createDefaultOptions,
  createDefaultTimelineOptions,
  createDefaultRippleOptions,
  createDefaultClusteringOptions,
  createDefaultAnalysisOptions,
  Graph,
  EvolutionTimeline,
  ImpactRipple,
  ClusteringResult,
  ArchitectureAnalysisResult,
  NLQueryResult,
  LayoutType,
  DependencyGraphFilters,
  ClusteringOptions,
  ArchitectureAnalysisOptions,
  NLQueryOptions,
} from '../visualization/index.js';
import { GraphRAGClient } from '../clients/graphrag-client.js';
import { MageAgentClient } from '../clients/mageagent-client.js';
import { TreeSitterService } from '../parsers/tree-sitter-service.js';
import { GitService } from '../git/git-service.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============================================================================
// Tool Definitions
// ============================================================================

export const VISUALIZATION_TOOLS = [
  {
    name: 'nexusmind_dependency_graph',
    description:
      'Build an interactive dependency graph for code visualization. Shows relationships between files, functions, and classes with customizable layouts.',
    inputSchema: {
      type: 'object',
      properties: {
        rootFile: {
          type: 'string',
          description: 'Root file or directory to start graph from',
        },
        depth: {
          type: 'number',
          description: 'Maximum depth to traverse (default: 3)',
        },
        layout: {
          type: 'string',
          enum: ['force', 'hierarchical', 'radial', 'organic'],
          description: 'Graph layout algorithm (default: force)',
        },
        nodeTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Node types to include: file, function, class, method, module',
        },
        edgeTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Edge types to include: imports, calls, extends, implements',
        },
        includeExternal: {
          type: 'boolean',
          description: 'Include external dependencies (default: false)',
        },
      },
      required: ['rootFile'],
    },
  },
  {
    name: 'nexusmind_evolution_timeline',
    description:
      'Visualize how a code entity has evolved over time. Shows commits, authors, and change patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: {
          type: 'string',
          description: 'File path or symbol name (e.g., "src/index.ts" or "src/index.ts:MyClass")',
        },
        startDate: {
          type: 'string',
          description: 'Start date for timeline (ISO format, default: 3 months ago)',
        },
        endDate: {
          type: 'string',
          description: 'End date for timeline (ISO format, default: now)',
        },
        granularity: {
          type: 'string',
          enum: ['commit', 'day', 'week', 'month'],
          description: 'Time aggregation level (default: day)',
        },
        showAuthors: {
          type: 'boolean',
          description: 'Include author information (default: true)',
        },
      },
      required: ['entity'],
    },
  },
  {
    name: 'nexusmind_impact_ripple',
    description:
      'Analyze the impact of changing a code entity. Shows concentric rings of affected code with severity indicators.',
    inputSchema: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: 'Entity identifier (file:path:symbol or just symbol name)',
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum depth of impact analysis (default: 3)',
        },
        includeTests: {
          type: 'boolean',
          description: 'Include test files in analysis (default: false)',
        },
        minimumImpactScore: {
          type: 'number',
          description: 'Minimum impact score threshold (default: 10)',
        },
      },
      required: ['entityId'],
    },
  },
  {
    name: 'nexusmind_semantic_clusters',
    description:
      'Group code by semantic similarity, not just structural dependencies. Identifies related code patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to find entities to cluster (or "all" for full codebase)',
        },
        algorithm: {
          type: 'string',
          enum: ['kmeans', 'dbscan', 'hierarchical'],
          description: 'Clustering algorithm (default: kmeans)',
        },
        numClusters: {
          type: 'number',
          description: 'Number of clusters for kmeans (auto-detected if not specified)',
        },
        minClusterSize: {
          type: 'number',
          description: 'Minimum cluster size for dbscan (default: 3)',
        },
        excludeTests: {
          type: 'boolean',
          description: 'Exclude test files (default: true)',
        },
      },
      required: [],
    },
  },
  {
    name: 'nexusmind_architecture_analyze',
    description:
      'Detect code smells and architecture issues. Provides actionable refactoring suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        targetPath: {
          type: 'string',
          description: 'Path to analyze (directory or file, default: entire repo)',
        },
        issueTypes: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Issue types: circular-dependency, god-class, tight-coupling, dead-code, feature-envy, missing-abstraction',
        },
        minConfidence: {
          type: 'number',
          description: 'Minimum confidence threshold 0-1 (default: 0.5)',
        },
        includeRefactoringSuggestions: {
          type: 'boolean',
          description: 'Generate AI-powered refactoring suggestions (default: true)',
        },
      },
      required: [],
    },
  },
  {
    name: 'nexusmind_nl_query',
    description:
      'Ask questions about your codebase in natural language. Returns visual answers and graph operations.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language question about the codebase',
        },
        selectedNodes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Currently selected nodes for context',
        },
      },
      required: ['query'],
    },
  },
];

// ============================================================================
// Visualization Handler
// ============================================================================

export class VisualizationHandler {
  private dependencyBuilder: DependencyGraphBuilder;
  private evolutionBuilder: EvolutionTimelineBuilder;
  private impactBuilder: ImpactRippleBuilder;
  private clusteringEngine: SemanticClusteringEngine;
  private architectureAdvisor: ArchitectureAdvisor;
  private nlQueryProcessor: NLGraphQueryProcessor;
  private initialized = false;

  constructor(
    private graphRAGClient: GraphRAGClient,
    private mageAgentClient: MageAgentClient | null,
    private treeSitterService: TreeSitterService,
    private gitService: GitService,
    private repoPath: string
  ) {
    // Initialize builders
    this.dependencyBuilder = new DependencyGraphBuilder(
      graphRAGClient,
      treeSitterService,
      repoPath
    );

    this.evolutionBuilder = new EvolutionTimelineBuilder(
      gitService,
      mageAgentClient,
      treeSitterService,
      repoPath
    );

    this.impactBuilder = new ImpactRippleBuilder(
      graphRAGClient,
      treeSitterService,
      repoPath
    );

    this.clusteringEngine = new SemanticClusteringEngine(graphRAGClient, mageAgentClient);

    this.architectureAdvisor = new ArchitectureAdvisor(
      graphRAGClient,
      mageAgentClient,
      treeSitterService,
      repoPath
    );

    this.nlQueryProcessor = new NLGraphQueryProcessor(
      graphRAGClient,
      mageAgentClient,
      treeSitterService,
      gitService,
      repoPath
    );

    this.initialized = true;
  }

  /**
   * Handle dependency graph request
   */
  async handleDependencyGraph(args: {
    rootFile: string;
    depth?: number;
    layout?: LayoutType;
    nodeTypes?: string[];
    edgeTypes?: string[];
    includeExternal?: boolean;
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    const startTime = Date.now();

    try {
      const options = createDefaultOptions(args.rootFile);
      options.depth = args.depth || 3;
      options.layout = (args.layout as LayoutType) || 'force';
      options.includeExternal = args.includeExternal || false;

      if (args.nodeTypes) {
        options.filters.nodeTypes = args.nodeTypes as any;
      }
      if (args.edgeTypes) {
        options.filters.edgeTypes = args.edgeTypes as any;
      }

      const graph = await this.dependencyBuilder.buildGraph(options);

      const duration = Date.now() - startTime;
      logger.info({ nodeCount: graph.nodes.length, duration }, 'Dependency graph built');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                graph,
                metadata: {
                  executionTime: duration,
                  rootFile: args.rootFile,
                  layout: options.layout,
                },
                summary: `Built dependency graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges.`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error({ error, args }, 'Dependency graph failed');
      return this.errorResponse(error);
    }
  }

  /**
   * Handle evolution timeline request
   */
  async handleEvolutionTimeline(args: {
    entity: string;
    startDate?: string;
    endDate?: string;
    granularity?: string;
    showAuthors?: boolean;
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    const startTime = Date.now();

    try {
      const options = createDefaultTimelineOptions(args.entity);

      if (args.startDate) {
        options.timeRange.start = new Date(args.startDate);
      }
      if (args.endDate) {
        options.timeRange.end = new Date(args.endDate);
      }
      if (args.granularity) {
        options.granularity = args.granularity as any;
      }
      if (args.showAuthors !== undefined) {
        options.showAuthors = args.showAuthors;
      }

      const timeline = await this.evolutionBuilder.buildTimeline(options);

      const duration = Date.now() - startTime;
      logger.info({ eventCount: timeline.events.length, duration }, 'Evolution timeline built');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                timeline,
                metadata: {
                  executionTime: duration,
                  entity: args.entity,
                },
                summary: `Timeline for "${args.entity}": ${timeline.statistics.totalCommits} commits, ${timeline.statistics.totalAuthors} authors. ${timeline.insights[0] || ''}`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error({ error, args }, 'Evolution timeline failed');
      return this.errorResponse(error);
    }
  }

  /**
   * Handle impact ripple request
   */
  async handleImpactRipple(args: {
    entityId: string;
    maxDepth?: number;
    includeTests?: boolean;
    minimumImpactScore?: number;
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    const startTime = Date.now();

    try {
      const options = createDefaultRippleOptions(args.entityId);
      if (args.maxDepth !== undefined) options.maxDepth = args.maxDepth;
      if (args.includeTests !== undefined) options.includeTests = args.includeTests;
      if (args.minimumImpactScore !== undefined) options.minimumImpactScore = args.minimumImpactScore;

      const ripple = await this.impactBuilder.buildRipple(options);

      const duration = Date.now() - startTime;
      logger.info({ totalAffected: ripple.totalAffected, duration }, 'Impact ripple built');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                ripple,
                metadata: {
                  executionTime: duration,
                  entityId: args.entityId,
                },
                summary: `Impact analysis: ${ripple.totalAffected} affected entities (${ripple.criticalCount} critical, ${ripple.highCount} high, ${ripple.mediumCount} medium, ${ripple.lowCount} low severity).`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error({ error, args }, 'Impact ripple failed');
      return this.errorResponse(error);
    }
  }

  /**
   * Handle semantic clustering request
   */
  async handleSemanticClusters(args: {
    query?: string;
    algorithm?: string;
    numClusters?: number;
    minClusterSize?: number;
    excludeTests?: boolean;
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    const startTime = Date.now();

    try {
      // Search for entities to cluster
      const searchQuery = args.query || 'functions and classes';
      const results = await this.graphRAGClient.search(searchQuery, {
        limit: 200,
        domain: 'code',
      });

      const entities = results.map((r, idx) => ({
        id: r.id || `entity-${idx}`,
        content: r.content,
        type: 'function' as const,
        path: (r.metadata.file_path as string) || '',
      }));

      const options = createDefaultClusteringOptions();
      if (args.algorithm) options.algorithm = args.algorithm as any;
      if (args.numClusters) options.numClusters = args.numClusters;
      if (args.minClusterSize) options.minClusterSize = args.minClusterSize;
      if (args.excludeTests !== undefined) options.excludeTests = args.excludeTests;

      const clustering = await this.clusteringEngine.clusterEntities(entities, options);

      const duration = Date.now() - startTime;
      logger.info({ clusterCount: clustering.clusters.length, duration }, 'Semantic clustering complete');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                clustering,
                metadata: {
                  executionTime: duration,
                  query: searchQuery,
                },
                summary: `Found ${clustering.clusters.length} semantic clusters from ${clustering.metadata.totalEntities} entities. Silhouette score: ${clustering.silhouetteScore.toFixed(2)}.`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error({ error, args }, 'Semantic clustering failed');
      return this.errorResponse(error);
    }
  }

  /**
   * Handle architecture analysis request
   */
  async handleArchitectureAnalyze(args: {
    targetPath?: string;
    issueTypes?: string[];
    minConfidence?: number;
    includeRefactoringSuggestions?: boolean;
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    const startTime = Date.now();

    try {
      const options = createDefaultAnalysisOptions(args.targetPath);
      if (args.issueTypes) options.issueTypes = args.issueTypes as any;
      if (args.minConfidence !== undefined) options.minConfidence = args.minConfidence;
      if (args.includeRefactoringSuggestions !== undefined) {
        options.includeRefactoringSuggestions = args.includeRefactoringSuggestions;
      }

      const result = await this.architectureAdvisor.analyze(options);

      const duration = Date.now() - startTime;
      logger.info({ issueCount: result.suggestions.length, duration }, 'Architecture analysis complete');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                analysis: result,
                metadata: {
                  executionTime: duration,
                  targetPath: args.targetPath || '.',
                },
                summary: result.summary,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error({ error, args }, 'Architecture analysis failed');
      return this.errorResponse(error);
    }
  }

  /**
   * Handle natural language query
   */
  async handleNLQuery(args: {
    query: string;
    selectedNodes?: string[];
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    const startTime = Date.now();

    try {
      const options: NLQueryOptions = {
        query: args.query,
        context: args.selectedNodes ? { selectedNodes: args.selectedNodes } : undefined,
      };

      const result = await this.nlQueryProcessor.processQuery(options);

      const duration = Date.now() - startTime;
      logger.info({ intent: result.operation, duration }, 'NL query processed');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                result,
                metadata: {
                  executionTime: duration,
                  query: args.query,
                },
                explanation: result.explanation,
                suggestedFollowUps: result.suggestedFollowUps,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      logger.error({ error, args }, 'NL query failed');
      return this.errorResponse(error);
    }
  }

  /**
   * Format error response
   */
  private errorResponse(error: unknown): { content: Array<{ type: string; text: string }> } {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            null,
            2
          ),
        },
      ],
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createVisualizationHandler(
  graphRAGClient: GraphRAGClient,
  mageAgentClient: MageAgentClient | null,
  treeSitterService: TreeSitterService,
  gitService: GitService,
  repoPath: string
): VisualizationHandler {
  return new VisualizationHandler(
    graphRAGClient,
    mageAgentClient,
    treeSitterService,
    gitService,
    repoPath
  );
}
