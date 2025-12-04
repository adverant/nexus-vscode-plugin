// src/visualization/architecture-advisor.ts
/**
 * NexusMind Architecture Advisor
 *
 * AI-driven architecture analysis that detects code smells,
 * suggests refactoring, and provides actionable improvement recommendations.
 */

import {
  ArchitectureSuggestion,
  ArchitectureAnalysisOptions,
  ArchitectureAnalysisResult,
  ArchitectureIssueType,
  IssueSeverity,
  Graph,
} from './types.js';
import { GraphAnalyzer } from './graph-engine.js';
import { DependencyGraphBuilder } from './dependency-graph.js';
import { GraphRAGClient } from '../clients/graphrag-client.js';
import { MageAgentClient } from '../clients/mageagent-client.js';
import { TreeSitterService } from '../parsers/tree-sitter-service.js';
import { ParsedFile, ASTNode } from '../types.js';
import pino from 'pino';
import { readFile } from 'fs/promises';
import { join } from 'path';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============================================================================
// Architecture Advisor
// ============================================================================

export class ArchitectureAdvisor {
  private dependencyGraphBuilder: DependencyGraphBuilder;

  constructor(
    private graphRAGClient: GraphRAGClient,
    private mageAgentClient: MageAgentClient | null,
    private treeSitterService: TreeSitterService,
    private repoPath: string
  ) {
    this.dependencyGraphBuilder = new DependencyGraphBuilder(
      graphRAGClient,
      treeSitterService,
      repoPath
    );
  }

  /**
   * Analyze architecture and provide suggestions
   */
  async analyze(options: ArchitectureAnalysisOptions): Promise<ArchitectureAnalysisResult> {
    const startTime = Date.now();
    logger.info({ scope: options.scope, targetPath: options.targetPath }, 'Starting architecture analysis');

    try {
      const suggestions: ArchitectureSuggestion[] = [];

      // Build dependency graph for analysis
      const graph = await this.dependencyGraphBuilder.buildGraph({
        rootFile: options.targetPath || '.',
        depth: 10,
        includeExternal: false,
        layout: 'force',
        filters: {
          nodeTypes: ['file', 'function', 'class'],
          edgeTypes: ['imports', 'calls', 'extends', 'implements'],
        },
      });

      const analyzer = new GraphAnalyzer(graph);

      // Run detectors based on requested issue types
      const issueTypes = options.issueTypes || [
        'circular-dependency',
        'god-class',
        'tight-coupling',
        'dead-code',
      ];

      if (issueTypes.includes('circular-dependency')) {
        suggestions.push(...await this.detectCircularDependencies(graph, analyzer, options));
      }

      if (issueTypes.includes('god-class')) {
        suggestions.push(...await this.detectGodClasses(graph, options));
      }

      if (issueTypes.includes('tight-coupling')) {
        suggestions.push(...await this.detectTightCoupling(graph, analyzer, options));
      }

      if (issueTypes.includes('dead-code')) {
        suggestions.push(...await this.detectDeadCode(graph, analyzer, options));
      }

      if (issueTypes.includes('feature-envy')) {
        suggestions.push(...await this.detectFeatureEnvy(graph, options));
      }

      if (issueTypes.includes('missing-abstraction')) {
        suggestions.push(...await this.detectMissingAbstractions(graph, analyzer, options));
      }

      // Filter by confidence threshold
      const filtered = suggestions.filter(
        (s) => s.confidence >= (options.minConfidence || 0.5)
      );

      // Generate refactoring suggestions if requested
      if (options.includeRefactoringSuggestions && this.mageAgentClient) {
        await this.enhanceWithRefactoringSuggestions(filtered);
      }

      // Calculate health score
      const healthScore = this.calculateHealthScore(filtered, graph);

      // Generate summary
      const summary = this.generateSummary(filtered, healthScore);

      // Calculate statistics
      const stats = this.calculateStatistics(filtered);

      const duration = Date.now() - startTime;
      logger.info(
        {
          suggestionCount: filtered.length,
          healthScore,
          duration,
        },
        'Architecture analysis complete'
      );

      return {
        suggestions: filtered.sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity)),
        healthScore,
        statistics: stats,
        summary,
      };
    } catch (error) {
      logger.error({ error, options }, 'Architecture analysis failed');
      throw new Error(
        `Architecture analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Detect circular dependencies
   */
  private async detectCircularDependencies(
    graph: Graph,
    analyzer: GraphAnalyzer,
    options: ArchitectureAnalysisOptions
  ): Promise<ArchitectureSuggestion[]> {
    const suggestions: ArchitectureSuggestion[] = [];
    const cycles = analyzer.findCircularDependencies();

    for (const cycle of cycles) {
      if (cycle.length < 2) continue;

      const severity: IssueSeverity = cycle.length > 3 ? 'error' : 'warning';
      const filesAffected = cycle.length;

      suggestions.push({
        id: `circular-${cycle.join('-').substring(0, 50)}`,
        type: 'circular-dependency',
        severity,
        entities: cycle,
        description: `Circular dependency detected involving ${cycle.length} files: ${cycle.slice(0, 3).join(' → ')}${cycle.length > 3 ? ' → ...' : ''}`,
        suggestedRefactoring: `Break the cycle by:
1. Extracting shared dependencies to a common module
2. Using dependency injection
3. Inverting one of the dependencies using interfaces`,
        estimatedImpact: {
          filesAffected,
          testCoverage: 0.7,
          riskLevel: cycle.length > 4 ? 'high' : 'medium',
        },
        confidence: 0.95,
        references: ['https://en.wikipedia.org/wiki/Circular_dependency'],
      });
    }

    return suggestions;
  }

  /**
   * Detect god classes (classes with too many responsibilities)
   */
  private async detectGodClasses(
    graph: Graph,
    options: ArchitectureAnalysisOptions
  ): Promise<ArchitectureSuggestion[]> {
    const suggestions: ArchitectureSuggestion[] = [];

    // Find class nodes with high complexity
    const classNodes = graph.nodes.filter((n) => n.type === 'class');

    for (const classNode of classNodes) {
      const complexity = classNode.metrics.complexity || 0;
      const linesOfCode = classNode.metrics.linesOfCode || 0;

      // Thresholds for god class detection
      const isLarge = linesOfCode > 500;
      const isComplex = complexity > 50;
      const hasManyDependents = graph.edges.filter((e) => e.target === classNode.id).length > 10;

      if (isLarge || isComplex || hasManyDependents) {
        const severity: IssueSeverity = (isLarge && isComplex) ? 'error' : 'warning';
        const reasons: string[] = [];

        if (isLarge) reasons.push(`large size (${linesOfCode} lines)`);
        if (isComplex) reasons.push(`high complexity (${complexity})`);
        if (hasManyDependents) reasons.push('many dependents');

        suggestions.push({
          id: `god-class-${classNode.id}`,
          type: 'god-class',
          severity,
          entities: [classNode.id],
          description: `\`${classNode.name}\` shows signs of being a god class: ${reasons.join(', ')}`,
          suggestedRefactoring: `Consider splitting into smaller, focused classes:
1. Identify distinct responsibilities
2. Extract related methods into new classes
3. Use composition over inheritance
4. Apply Single Responsibility Principle`,
          estimatedImpact: {
            filesAffected: Math.ceil(linesOfCode / 100),
            testCoverage: 0.6,
            riskLevel: isLarge && isComplex ? 'high' : 'medium',
          },
          confidence: 0.8,
        });
      }
    }

    return suggestions;
  }

  /**
   * Detect tight coupling between modules
   */
  private async detectTightCoupling(
    graph: Graph,
    analyzer: GraphAnalyzer,
    options: ArchitectureAnalysisOptions
  ): Promise<ArchitectureSuggestion[]> {
    const suggestions: ArchitectureSuggestion[] = [];

    // Calculate coupling metrics
    const fileNodes = graph.nodes.filter((n) => n.type === 'file');

    for (const fileNode of fileNodes) {
      // Count outgoing dependencies
      const outgoingEdges = graph.edges.filter((e) => e.source === fileNode.id);
      const incomingEdges = graph.edges.filter((e) => e.target === fileNode.id);

      const afferentCoupling = incomingEdges.length; // Ca - who depends on me
      const efferentCoupling = outgoingEdges.length; // Ce - who I depend on

      // High efferent coupling = too many dependencies
      if (efferentCoupling > 15) {
        suggestions.push({
          id: `tight-coupling-efferent-${fileNode.id}`,
          type: 'tight-coupling',
          severity: efferentCoupling > 25 ? 'error' : 'warning',
          entities: [fileNode.id, ...outgoingEdges.slice(0, 5).map((e) => e.target)],
          description: `\`${fileNode.name}\` has high efferent coupling (${efferentCoupling} dependencies)`,
          suggestedRefactoring: `Reduce dependencies by:
1. Using dependency injection
2. Creating facades for related dependencies
3. Breaking into smaller, focused modules
4. Using interfaces instead of concrete implementations`,
          estimatedImpact: {
            filesAffected: efferentCoupling,
            testCoverage: 0.5,
            riskLevel: 'medium',
          },
          confidence: 0.85,
        });
      }

      // High afferent coupling with instability = fragile component
      const instability = efferentCoupling / (afferentCoupling + efferentCoupling || 1);
      if (afferentCoupling > 10 && instability > 0.5) {
        suggestions.push({
          id: `tight-coupling-fragile-${fileNode.id}`,
          type: 'tight-coupling',
          severity: 'warning',
          entities: [fileNode.id],
          description: `\`${fileNode.name}\` is a fragile dependency (${afferentCoupling} dependents, instability: ${instability.toFixed(2)})`,
          suggestedRefactoring: `Stabilize this component by:
1. Reducing its own dependencies
2. Using abstract interfaces
3. Moving volatile parts to dependent modules`,
          estimatedImpact: {
            filesAffected: afferentCoupling,
            testCoverage: 0.7,
            riskLevel: 'medium',
          },
          confidence: 0.75,
        });
      }
    }

    return suggestions;
  }

  /**
   * Detect dead code (unreferenced entities)
   */
  private async detectDeadCode(
    graph: Graph,
    analyzer: GraphAnalyzer,
    options: ArchitectureAnalysisOptions
  ): Promise<ArchitectureSuggestion[]> {
    const suggestions: ArchitectureSuggestion[] = [];

    // Find nodes with no incoming edges (except entry points)
    const entryPatterns = ['index', 'main', 'app', 'server', 'cli'];

    for (const node of graph.nodes) {
      if (node.type !== 'function' && node.type !== 'class') continue;

      const incomingEdges = graph.edges.filter((e) => e.target === node.id);
      const isEntryPoint = entryPatterns.some((p) => node.name.toLowerCase().includes(p));
      const isExported = node.path.includes('index') || node.name.startsWith('export');

      if (incomingEdges.length === 0 && !isEntryPoint && !isExported) {
        suggestions.push({
          id: `dead-code-${node.id}`,
          type: 'dead-code',
          severity: 'info',
          entities: [node.id],
          description: `\`${node.name}\` in \`${node.path}\` appears to be unused`,
          suggestedRefactoring: `If this code is truly unused:
1. Remove the code
2. If keeping for future use, add a TODO comment
3. Consider moving to a separate "deprecated" module`,
          estimatedImpact: {
            filesAffected: 1,
            testCoverage: 0.9,
            riskLevel: 'low',
          },
          confidence: 0.6, // Lower confidence as we might miss dynamic references
        });
      }
    }

    return suggestions;
  }

  /**
   * Detect feature envy (methods that use other classes more than their own)
   */
  private async detectFeatureEnvy(
    graph: Graph,
    options: ArchitectureAnalysisOptions
  ): Promise<ArchitectureSuggestion[]> {
    const suggestions: ArchitectureSuggestion[] = [];

    // Find methods with many external calls
    const methodNodes = graph.nodes.filter((n) => n.type === 'method' || n.type === 'function');

    for (const method of methodNodes) {
      const outgoingCalls = graph.edges.filter(
        (e) => e.source === method.id && e.type === 'calls'
      );

      // Group by target file
      const callsByFile = new Map<string, number>();
      for (const call of outgoingCalls) {
        const targetNode = graph.nodes.find((n) => n.id === call.target);
        if (targetNode && targetNode.path !== method.path) {
          callsByFile.set(targetNode.path, (callsByFile.get(targetNode.path) || 0) + 1);
        }
      }

      // Check if any external file has more calls than threshold
      for (const [externalPath, callCount] of callsByFile) {
        if (callCount >= 3) {
          suggestions.push({
            id: `feature-envy-${method.id}-${externalPath}`,
            type: 'feature-envy',
            severity: 'info',
            entities: [method.id, externalPath],
            description: `\`${method.name}\` makes ${callCount} calls to \`${externalPath}\`, suggesting feature envy`,
            suggestedRefactoring: `Consider:
1. Moving this method to ${externalPath}
2. Extracting the related logic into ${externalPath}
3. Creating a new class that encapsulates both`,
            estimatedImpact: {
              filesAffected: 2,
              testCoverage: 0.8,
              riskLevel: 'low',
            },
            confidence: 0.7,
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Detect missing abstractions (duplicate patterns)
   */
  private async detectMissingAbstractions(
    graph: Graph,
    analyzer: GraphAnalyzer,
    options: ArchitectureAnalysisOptions
  ): Promise<ArchitectureSuggestion[]> {
    const suggestions: ArchitectureSuggestion[] = [];

    // Find strongly connected components that might benefit from abstraction
    const sccs = analyzer.findStronglyConnectedComponents();

    for (const scc of sccs) {
      if (scc.length >= 3) {
        suggestions.push({
          id: `missing-abstraction-${scc.slice(0, 3).join('-')}`,
          type: 'missing-abstraction',
          severity: 'info',
          entities: scc,
          description: `${scc.length} tightly coupled components might benefit from a shared abstraction`,
          suggestedRefactoring: `Consider:
1. Extracting common interfaces
2. Creating a base class or mixin
3. Using a shared utility module`,
          estimatedImpact: {
            filesAffected: scc.length,
            testCoverage: 0.6,
            riskLevel: 'medium',
          },
          confidence: 0.65,
        });
      }
    }

    return suggestions;
  }

  /**
   * Enhance suggestions with AI-generated refactoring details
   */
  private async enhanceWithRefactoringSuggestions(
    suggestions: ArchitectureSuggestion[]
  ): Promise<void> {
    if (!this.mageAgentClient) return;

    // Only enhance high-severity issues to save API calls
    const highSeverity = suggestions.filter(
      (s) => s.severity === 'error' || s.severity === 'critical'
    );

    for (const suggestion of highSeverity.slice(0, 5)) {
      try {
        const prompt = `Provide specific refactoring steps for this code architecture issue:

Issue Type: ${suggestion.type}
Description: ${suggestion.description}
Affected Files: ${suggestion.entities.slice(0, 5).join(', ')}

Provide 3-5 concrete, actionable steps.`;

        const job = await this.mageAgentClient.orchestrate(prompt, {
          maxAgents: 1,
          timeout: 15000,
        });

        // Wait for job completion and get result
        const jobResult = await this.mageAgentClient.waitForCompletion(job.jobId, 1000, 15000);
        if (jobResult.result) {
          suggestion.suggestedRefactoring = jobResult.result as string;
        }
      } catch (error) {
        logger.warn({ suggestionId: suggestion.id, error }, 'Failed to enhance with AI');
      }
    }
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(suggestions: ArchitectureSuggestion[], graph: Graph): number {
    if (graph.nodes.length === 0) return 100;

    let penalty = 0;

    for (const suggestion of suggestions) {
      const weight = this.getSeverityWeight(suggestion.severity);
      penalty += weight * suggestion.entities.length;
    }

    // Normalize penalty relative to codebase size
    const maxPenalty = graph.nodes.length * 10;
    const score = Math.max(0, 100 - (penalty / maxPenalty) * 100);

    return Math.round(score);
  }

  /**
   * Get severity weight for scoring
   */
  private getSeverityWeight(severity: IssueSeverity): number {
    switch (severity) {
      case 'critical': return 10;
      case 'error': return 5;
      case 'warning': return 2;
      case 'info': return 0.5;
      default: return 1;
    }
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(suggestions: ArchitectureSuggestion[], healthScore: number): string {
    if (suggestions.length === 0) {
      return 'No significant architecture issues detected. The codebase appears well-structured.';
    }

    const parts: string[] = [];

    // Health indicator
    if (healthScore >= 80) {
      parts.push(`Overall architecture health is good (${healthScore}/100).`);
    } else if (healthScore >= 60) {
      parts.push(`Architecture health is moderate (${healthScore}/100) with some areas for improvement.`);
    } else {
      parts.push(`Architecture health needs attention (${healthScore}/100) with several issues to address.`);
    }

    // Summarize by type
    const byType = new Map<ArchitectureIssueType, number>();
    for (const s of suggestions) {
      byType.set(s.type, (byType.get(s.type) || 0) + 1);
    }

    const issues: string[] = [];
    for (const [type, count] of byType) {
      issues.push(`${count} ${type.replace(/-/g, ' ')} issue(s)`);
    }

    if (issues.length > 0) {
      parts.push(`Found: ${issues.join(', ')}.`);
    }

    // Priority recommendation
    const critical = suggestions.filter((s) => s.severity === 'critical' || s.severity === 'error');
    if (critical.length > 0) {
      parts.push(`Priority: Address ${critical.length} high-severity issue(s) first.`);
    }

    return parts.join(' ');
  }

  /**
   * Calculate statistics
   */
  private calculateStatistics(suggestions: ArchitectureSuggestion[]): ArchitectureAnalysisResult['statistics'] {
    return {
      totalIssues: suggestions.length,
      criticalCount: suggestions.filter((s) => s.severity === 'critical').length +
                     suggestions.filter((s) => s.severity === 'error').length,
      warningCount: suggestions.filter((s) => s.severity === 'warning').length,
      infoCount: suggestions.filter((s) => s.severity === 'info').length,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createDefaultAnalysisOptions(targetPath?: string): ArchitectureAnalysisOptions {
  return {
    scope: targetPath ? 'directory' : 'all',
    targetPath,
    issueTypes: [
      'circular-dependency',
      'god-class',
      'tight-coupling',
      'dead-code',
    ],
    minConfidence: 0.5,
    includeRefactoringSuggestions: true,
  };
}
