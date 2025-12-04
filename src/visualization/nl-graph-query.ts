// src/visualization/nl-graph-query.ts
/**
 * NexusMind Natural Language Graph Query
 *
 * Translates natural language questions into graph operations
 * and visualization actions. Powers the "ask about your codebase" feature.
 */

import {
  NLQueryResult,
  NLQueryOptions,
  GraphOperation,
  Graph,
  DependencyGraphFilters,
  LayoutType,
  EvolutionTimeline,
  ImpactRipple,
  ClusteringResult,
} from './types.js';
import { DependencyGraphBuilder, createDefaultFilters } from './dependency-graph.js';
import { EvolutionTimelineBuilder, createDefaultTimelineOptions } from './evolution-timeline.js';
import { ImpactRippleBuilder, createDefaultRippleOptions } from './impact-ripple.js';
import { SemanticClusteringEngine, createDefaultClusteringOptions } from './semantic-clusters.js';
import { GraphRAGClient } from '../clients/graphrag-client.js';
import { MageAgentClient } from '../clients/mageagent-client.js';
import { TreeSitterService } from '../parsers/tree-sitter-service.js';
import { GitService } from '../git/git-service.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============================================================================
// Query Intent Types
// ============================================================================

type QueryIntent =
  | 'dependency'       // "What depends on X?"
  | 'impact'           // "What would break if I change X?"
  | 'evolution'        // "How has X changed over time?"
  | 'clustering'       // "Show me related code to X"
  | 'architecture'     // "Show me the architecture of X"
  | 'navigation'       // "Where is X defined?"
  | 'comparison'       // "Compare X and Y"
  | 'security'         // "What security issues exist?"
  | 'general';         // Fallback

interface ParsedQuery {
  intent: QueryIntent;
  entities: string[];
  modifiers: {
    depth?: number;
    timeRange?: { start: Date; end: Date };
    includeTests?: boolean;
    layout?: LayoutType;
    filter?: string;
  };
  rawQuery: string;
}

// ============================================================================
// Natural Language Query Processor
// ============================================================================

export class NLGraphQueryProcessor {
  private dependencyBuilder: DependencyGraphBuilder;
  private evolutionBuilder: EvolutionTimelineBuilder;
  private impactBuilder: ImpactRippleBuilder;
  private clusteringEngine: SemanticClusteringEngine;

  constructor(
    private graphRAGClient: GraphRAGClient,
    private mageAgentClient: MageAgentClient | null,
    private treeSitterService: TreeSitterService,
    private gitService: GitService,
    private repoPath: string
  ) {
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
    this.clusteringEngine = new SemanticClusteringEngine(
      graphRAGClient,
      mageAgentClient
    );
  }

  /**
   * Process natural language query
   */
  async processQuery(options: NLQueryOptions): Promise<NLQueryResult> {
    const startTime = Date.now();
    logger.info({ query: options.query }, 'Processing natural language query');

    try {
      // Parse the query to understand intent
      const parsed = await this.parseQuery(options.query, options.context);
      logger.debug({ intent: parsed.intent, entities: parsed.entities }, 'Parsed query');

      // Execute the appropriate operation
      const result = await this.executeQuery(parsed, options);

      const duration = Date.now() - startTime;
      logger.info(
        { intent: parsed.intent, duration },
        'Natural language query processed'
      );

      return result;
    } catch (error) {
      logger.error({ error, query: options.query }, 'Failed to process NL query');
      throw new Error(
        `Query processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse query to extract intent and entities
   */
  private async parseQuery(
    query: string,
    context?: NLQueryOptions['context']
  ): Promise<ParsedQuery> {
    const lowerQuery = query.toLowerCase();
    let intent: QueryIntent = 'general';
    const entities: string[] = [];
    const modifiers: ParsedQuery['modifiers'] = {};

    // Intent detection patterns
    const intentPatterns: Array<{ pattern: RegExp; intent: QueryIntent }> = [
      // Dependency queries
      { pattern: /what (?:depends on|uses|imports|calls)\s+(.+)/i, intent: 'dependency' },
      { pattern: /show (?:me )?(?:the )?dependencies (?:of|for)\s+(.+)/i, intent: 'dependency' },
      { pattern: /who (?:uses|calls|imports)\s+(.+)/i, intent: 'dependency' },

      // Impact queries
      { pattern: /what (?:would|will) (?:break|change|be affected) if (?:i |we )?(?:change|modify|update)\s+(.+)/i, intent: 'impact' },
      { pattern: /impact (?:of|analysis for)\s+(.+)/i, intent: 'impact' },
      { pattern: /ripple effect (?:of|for)\s+(.+)/i, intent: 'impact' },

      // Evolution queries
      { pattern: /how has (.+) (?:changed|evolved|been modified)/i, intent: 'evolution' },
      { pattern: /history (?:of|for)\s+(.+)/i, intent: 'evolution' },
      { pattern: /when was (.+) (?:last )?(?:changed|modified|updated)/i, intent: 'evolution' },

      // Clustering queries
      { pattern: /show (?:me )?(?:code )?(?:similar|related) to\s+(.+)/i, intent: 'clustering' },
      { pattern: /find (?:code )?(?:like|similar to)\s+(.+)/i, intent: 'clustering' },
      { pattern: /cluster|group|organize\s+(?:the )?(?:code|files)/i, intent: 'clustering' },

      // Architecture queries
      { pattern: /show (?:me )?(?:the )?architecture (?:of|for)\s+(.+)/i, intent: 'architecture' },
      { pattern: /(?:overview|structure|diagram) (?:of|for)\s+(.+)/i, intent: 'architecture' },

      // Navigation queries
      { pattern: /where is (.+) defined/i, intent: 'navigation' },
      { pattern: /find (?:the )?(?:definition|declaration) (?:of|for)\s+(.+)/i, intent: 'navigation' },
      { pattern: /locate\s+(.+)/i, intent: 'navigation' },

      // Comparison queries
      { pattern: /compare (.+) (?:and|with|to|vs)\s+(.+)/i, intent: 'comparison' },
      { pattern: /difference(?:s)? between (.+) and\s+(.+)/i, intent: 'comparison' },

      // Security queries
      { pattern: /(?:security|vulnerabilit(?:y|ies)|issues?) (?:in|for)\s+(.+)/i, intent: 'security' },
      { pattern: /find (?:security )?(?:issues|problems|vulnerabilities)/i, intent: 'security' },
    ];

    // Try to match intent patterns
    for (const { pattern, intent: matchIntent } of intentPatterns) {
      const match = query.match(pattern);
      if (match) {
        intent = matchIntent;
        // Extract entities from captured groups
        for (let i = 1; i < match.length; i++) {
          if (match[i]) {
            entities.push(match[i].trim().replace(/['"]/g, ''));
          }
        }
        break;
      }
    }

    // Extract modifier patterns
    const depthMatch = query.match(/(?:depth|level(?:s)?)\s*(?:of\s*)?(\d+)/i);
    if (depthMatch) {
      modifiers.depth = parseInt(depthMatch[1]);
    }

    const timeMatch = query.match(/(?:last|past)\s+(\d+)\s+(day|week|month)s?/i);
    if (timeMatch) {
      const amount = parseInt(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      const now = new Date();
      const start = new Date(now);

      if (unit === 'day') start.setDate(now.getDate() - amount);
      else if (unit === 'week') start.setDate(now.getDate() - amount * 7);
      else if (unit === 'month') start.setMonth(now.getMonth() - amount);

      modifiers.timeRange = { start, end: now };
    }

    if (lowerQuery.includes('include test') || lowerQuery.includes('with test')) {
      modifiers.includeTests = true;
    }

    // Layout preference
    if (lowerQuery.includes('hierarchical') || lowerQuery.includes('tree')) {
      modifiers.layout = 'hierarchical';
    } else if (lowerQuery.includes('radial') || lowerQuery.includes('circular')) {
      modifiers.layout = 'radial';
    }

    // If no entities found, try to extract file/symbol names
    if (entities.length === 0) {
      const filePattern = /(?:file|module)\s+['""]?([a-zA-Z0-9_./\-]+)['""]?/i;
      const symbolPattern = /(?:function|class|method|variable)\s+['""]?([a-zA-Z0-9_]+)['""]?/i;
      const quotedPattern = /['""]([^'""]+)['"]/g;

      const fileMatch = query.match(filePattern);
      if (fileMatch) entities.push(fileMatch[1]);

      const symbolMatch = query.match(symbolPattern);
      if (symbolMatch) entities.push(symbolMatch[1]);

      let quotedMatch;
      while ((quotedMatch = quotedPattern.exec(query)) !== null) {
        if (!entities.includes(quotedMatch[1])) {
          entities.push(quotedMatch[1]);
        }
      }
    }

    // Use context if available
    if (context?.selectedNodes && context.selectedNodes.length > 0 && entities.length === 0) {
      entities.push(...context.selectedNodes);
    }

    return {
      intent,
      entities,
      modifiers,
      rawQuery: query,
    };
  }

  /**
   * Execute query based on parsed intent
   */
  private async executeQuery(
    parsed: ParsedQuery,
    options: NLQueryOptions
  ): Promise<NLQueryResult> {
    switch (parsed.intent) {
      case 'dependency':
        return this.executeDependencyQuery(parsed, options);

      case 'impact':
        return this.executeImpactQuery(parsed, options);

      case 'evolution':
        return this.executeEvolutionQuery(parsed, options);

      case 'clustering':
        return this.executeClusteringQuery(parsed, options);

      case 'architecture':
        return this.executeArchitectureQuery(parsed, options);

      case 'navigation':
        return this.executeNavigationQuery(parsed, options);

      case 'comparison':
        return this.executeComparisonQuery(parsed, options);

      case 'security':
        return this.executeSecurityQuery(parsed, options);

      default:
        return this.executeGeneralQuery(parsed, options);
    }
  }

  /**
   * Execute dependency query
   */
  private async executeDependencyQuery(
    parsed: ParsedQuery,
    options: NLQueryOptions
  ): Promise<NLQueryResult> {
    const rootFile = parsed.entities[0] || '.';

    const graph = await this.dependencyBuilder.buildGraph({
      rootFile,
      depth: parsed.modifiers.depth || 3,
      includeExternal: false,
      layout: parsed.modifiers.layout || 'force',
      filters: {
        ...createDefaultFilters(),
        excludePatterns: parsed.modifiers.includeTests ? [] : ['test', 'spec', '__tests__'],
      },
    });

    return {
      operation: 'highlight',
      targets: parsed.entities,
      visualization: {
        layout: parsed.modifiers.layout || 'force',
        highlightColor: '#3b82f6',
      },
      data: graph,
      explanation: `Showing dependencies ${parsed.entities.length > 0 ? `for "${parsed.entities[0]}"` : 'for the codebase'}. Found ${graph.nodes.length} nodes and ${graph.edges.length} edges.`,
      suggestedFollowUps: [
        'What would break if I change this?',
        'Show me the evolution over time',
        'Find similar code patterns',
      ],
    };
  }

  /**
   * Execute impact query
   */
  private async executeImpactQuery(
    parsed: ParsedQuery,
    options: NLQueryOptions
  ): Promise<NLQueryResult> {
    const entityId = parsed.entities[0] || '';

    const ripple = await this.impactBuilder.buildRipple({
      entityId,
      maxDepth: parsed.modifiers.depth || 3,
      includeTests: parsed.modifiers.includeTests || false,
      minimumImpactScore: 10,
    });

    return {
      operation: 'animate',
      targets: [entityId],
      visualization: {
        animationType: 'ripple',
        highlightColor: '#ef4444',
      },
      data: ripple,
      explanation: `Impact analysis for "${parsed.entities[0]}": ${ripple.totalAffected} affected entities (${ripple.criticalCount} critical, ${ripple.highCount} high, ${ripple.mediumCount} medium severity).`,
      suggestedFollowUps: [
        'Show me the dependency graph',
        'How has this code evolved?',
        'What tests cover this code?',
      ],
    };
  }

  /**
   * Execute evolution query
   */
  private async executeEvolutionQuery(
    parsed: ParsedQuery,
    options: NLQueryOptions
  ): Promise<NLQueryResult> {
    const entity = parsed.entities[0] || '';

    const timelineOptions = createDefaultTimelineOptions(entity);
    if (parsed.modifiers.timeRange) {
      timelineOptions.timeRange = parsed.modifiers.timeRange;
    }

    const timeline = await this.evolutionBuilder.buildTimeline(timelineOptions);

    return {
      operation: 'focus',
      targets: [entity],
      visualization: {
        layout: 'hierarchical',
      },
      data: timeline,
      explanation: `Evolution history for "${entity}": ${timeline.statistics.totalCommits} commits by ${timeline.statistics.totalAuthors} author(s). ${timeline.insights[0] || ''}`,
      suggestedFollowUps: [
        'Who contributed the most?',
        'What changed in the last month?',
        'Show impact of recent changes',
      ],
    };
  }

  /**
   * Execute clustering query
   */
  private async executeClusteringQuery(
    parsed: ParsedQuery,
    options: NLQueryOptions
  ): Promise<NLQueryResult> {
    // Get all code entities from GraphRAG
    const searchQuery = parsed.entities[0] || 'all functions and classes';
    const results = await this.graphRAGClient.search(searchQuery, { limit: 100, domain: 'code' });

    const entities = results.map((r, idx) => ({
      id: r.id || `entity-${idx}`,
      content: r.content,
      type: 'function' as const,
      path: (r.metadata.file_path as string) || '',
    }));

    const clustering = await this.clusteringEngine.clusterEntities(
      entities,
      {
        ...createDefaultClusteringOptions(),
        excludeTests: !parsed.modifiers.includeTests,
      }
    );

    return {
      operation: 'filter',
      targets: parsed.entities,
      data: clustering,
      explanation: `Found ${clustering.clusters.length} semantic clusters with ${clustering.metadata.totalEntities} entities. ${clustering.unclustered.length} entities were not clustered.`,
      suggestedFollowUps: [
        'Show dependencies between clusters',
        'What are the largest clusters?',
        'Find outliers',
      ],
    };
  }

  /**
   * Execute architecture query
   */
  private async executeArchitectureQuery(
    parsed: ParsedQuery,
    options: NLQueryOptions
  ): Promise<NLQueryResult> {
    const rootPath = parsed.entities[0] || '.';

    const graph = await this.dependencyBuilder.buildGraph({
      rootFile: rootPath,
      depth: parsed.modifiers.depth || 5,
      includeExternal: false,
      layout: 'hierarchical',
      filters: {
        nodeTypes: ['file', 'module'],
        edgeTypes: ['imports', 'contains'],
        excludePatterns: ['test', 'spec', '__tests__', 'node_modules'],
      },
    });

    return {
      operation: 'expand',
      targets: parsed.entities,
      visualization: {
        layout: 'hierarchical',
        colorScheme: 'category',
      },
      data: graph,
      explanation: `Architecture overview ${parsed.entities.length > 0 ? `for "${parsed.entities[0]}"` : ''}: ${graph.nodes.length} modules with ${graph.edges.length} connections.`,
      suggestedFollowUps: [
        'Find circular dependencies',
        'Show most connected modules',
        'Analyze architecture health',
      ],
    };
  }

  /**
   * Execute navigation query
   */
  private async executeNavigationQuery(
    parsed: ParsedQuery,
    options: NLQueryOptions
  ): Promise<NLQueryResult> {
    const symbol = parsed.entities[0] || '';

    // Search for the symbol
    const results = await this.graphRAGClient.search(`definition of ${symbol}`, {
      limit: 5,
      domain: 'code',
    });

    const locations = results.map((r) => ({
      path: r.metadata.file_path as string,
      line: r.metadata.line as number,
      content: r.content,
    }));

    // Build a small graph around the found definitions
    const graph = await this.dependencyBuilder.buildGraph({
      rootFile: locations[0]?.path || '.',
      depth: 1,
      includeExternal: false,
      layout: 'radial',
      filters: createDefaultFilters(),
    });

    return {
      operation: 'focus',
      targets: locations.map((l) => l.path),
      visualization: {
        layout: 'radial',
        highlightColor: '#22c55e',
      },
      data: graph,
      explanation: `Found "${symbol}" in ${locations.length} location(s): ${locations.map((l) => `${l.path}:${l.line || '?'}`).join(', ')}`,
      suggestedFollowUps: [
        'Who uses this symbol?',
        'Show its dependencies',
        'How has it changed over time?',
      ],
    };
  }

  /**
   * Execute comparison query
   */
  private async executeComparisonQuery(
    parsed: ParsedQuery,
    options: NLQueryOptions
  ): Promise<NLQueryResult> {
    // Build graphs for both entities
    const [entity1, entity2] = parsed.entities;

    const graph1 = await this.dependencyBuilder.buildGraph({
      rootFile: entity1 || '.',
      depth: 2,
      includeExternal: false,
      layout: 'force',
      filters: createDefaultFilters(),
    });

    // Combine into single graph with comparison markers
    // For now, just show the first entity's graph
    return {
      operation: 'compare',
      targets: [entity1, entity2].filter(Boolean),
      data: graph1,
      explanation: `Comparing "${entity1 || 'unknown'}" with "${entity2 || 'unknown'}". Use the visualization to explore differences.`,
      suggestedFollowUps: [
        'What do they have in common?',
        'Which has more dependencies?',
        'Show evolution of both',
      ],
    };
  }

  /**
   * Execute security query
   */
  private async executeSecurityQuery(
    parsed: ParsedQuery,
    options: NLQueryOptions
  ): Promise<NLQueryResult> {
    const targetPath = parsed.entities[0] || '.';

    // Build dependency graph and filter to nodes with vulnerabilities
    const graph = await this.dependencyBuilder.buildGraph({
      rootFile: targetPath,
      depth: 5,
      includeExternal: false,
      layout: 'force',
      filters: {
        ...createDefaultFilters(),
        vulnerabilityFilter: 'affected',
      },
    });

    const affectedNodes = graph.nodes.filter((n) => n.vulnerabilities.length > 0);

    return {
      operation: 'highlight',
      targets: affectedNodes.map((n) => n.id),
      visualization: {
        highlightColor: '#ef4444',
      },
      data: graph,
      explanation: `Security analysis: Found ${affectedNodes.length} files with potential vulnerabilities.`,
      suggestedFollowUps: [
        'Show details of vulnerabilities',
        'What depends on affected code?',
        'Show vulnerability timeline',
      ],
    };
  }

  /**
   * Execute general query (fallback)
   */
  private async executeGeneralQuery(
    parsed: ParsedQuery,
    options: NLQueryOptions
  ): Promise<NLQueryResult> {
    // Use GraphRAG to find relevant code
    const results = await this.graphRAGClient.search(parsed.rawQuery, {
      limit: 10,
      domain: 'code',
    });

    // Build a graph from search results
    const paths = [...new Set(results.map((r) => r.metadata.file_path as string).filter(Boolean))];

    const graph = await this.dependencyBuilder.buildGraph({
      rootFile: paths[0] || '.',
      depth: 2,
      includeExternal: false,
      layout: 'force',
      filters: createDefaultFilters(),
    });

    return {
      operation: 'highlight',
      targets: results.map((r) => r.id),
      data: graph,
      explanation: `Found ${results.length} relevant code sections for your query. Top result: "${results[0]?.content.substring(0, 100) || 'No results'}..."`,
      suggestedFollowUps: [
        'Show more details',
        'What depends on this code?',
        'Find similar code',
      ],
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createNLQueryProcessor(
  graphRAGClient: GraphRAGClient,
  mageAgentClient: MageAgentClient | null,
  treeSitterService: TreeSitterService,
  gitService: GitService,
  repoPath: string
): NLGraphQueryProcessor {
  return new NLGraphQueryProcessor(
    graphRAGClient,
    mageAgentClient,
    treeSitterService,
    gitService,
    repoPath
  );
}
