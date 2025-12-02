// src/handlers/impact-analysis.ts
import { GraphRAGClient } from '../clients/graphrag-client.js';
import { TreeSitterService } from '../parsers/tree-sitter-service.js';
import { ASTNode } from '../types.js';
import pino from 'pino';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { readdir } from 'fs/promises';
import { extname, relative } from 'path';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export type ImpactLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Usage {
  filePath: string;
  line: number;
  context: string;
  usageType: 'call' | 'import' | 'inheritance' | 'reference';
}

export interface ImpactItem {
  symbol: string;
  filePath: string;
  impactLevel: ImpactLevel;
  impactScore: number;
  usages: Usage[];
  depth: number; // Graph depth from original symbol
  reason: string;
}

export interface ImpactAnalysisResult {
  targetSymbol: string;
  targetFile: string;
  totalImpact: number;
  impacts: ImpactItem[];
  graphDepth: number;
  analysisTimestamp: Date;
}

interface GraphNode {
  symbol: string;
  filePath: string;
  depth: number;
  usages: Usage[];
}

export class ImpactAnalysisHandler {
  constructor(
    private graphRAGClient: GraphRAGClient,
    private treeSitterService: TreeSitterService,
    private repoPath: string
  ) {}

  /**
   * Analyze the impact of changing a symbol (function/class)
   * Returns all code that depends on this symbol, ranked by severity
   */
  async analyzeImpact(
    symbol: string,
    filePath?: string
  ): Promise<ImpactAnalysisResult> {
    try {
      logger.info({ symbol, filePath }, 'Starting impact analysis');

      // 1. Find the symbol's definition if filePath not provided
      const targetFile = filePath || (await this.findSymbolDefinition(symbol));
      if (!targetFile) {
        throw new Error(`Symbol '${symbol}' not found in codebase`);
      }

      // 2. Find all direct usages in the codebase
      const directUsages = await this.findUsages(symbol, targetFile);
      logger.debug({ usageCount: directUsages.length }, 'Found direct usages');

      // 3. Query GraphRAG for dependency relationships
      const graphDependencies = await this.queryGraphRAGDependencies(symbol, targetFile);
      logger.debug({ dependencyCount: graphDependencies.length }, 'Found graph dependencies');

      // 4. Build dependency graph and traverse to find indirect impacts
      const impactGraph = await this.buildImpactGraph(
        symbol,
        targetFile,
        directUsages,
        graphDependencies
      );

      // 5. Calculate impact scores and rank
      const rankedImpacts = await this.rankImpacts(impactGraph, symbol, targetFile);

      // 6. Calculate total impact metrics
      const totalImpact = rankedImpacts.reduce((sum, item) => sum + item.impactScore, 0);
      const maxDepth = Math.max(...rankedImpacts.map((item) => item.depth), 0);

      return {
        targetSymbol: symbol,
        targetFile,
        totalImpact,
        impacts: rankedImpacts,
        graphDepth: maxDepth,
        analysisTimestamp: new Date(),
      };
    } catch (error) {
      logger.error({ error, symbol, filePath }, 'Impact analysis failed');
      throw new Error(
        `Impact analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find all direct references to a symbol in the codebase
   */
  async findUsages(symbol: string, scope?: string): Promise<Usage[]> {
    try {
      const usages: Usage[] = [];

      // Determine search scope (specific file or entire repo)
      const searchRoot = scope ? join(this.repoPath, scope) : this.repoPath;

      // Find all files to search
      const files = await this.findSourceFiles(searchRoot);

      logger.debug({ fileCount: files.length, searchRoot }, 'Searching files for usages');

      // Search each file for the symbol
      for (const file of files) {
        try {
          const content = await readFile(file, 'utf-8');
          const lines = content.split('\n');

          // Find lines that reference the symbol
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const relativePath = file.replace(this.repoPath + '/', '');

            // Check for various usage patterns
            if (this.isSymbolUsage(line, symbol)) {
              const usageType = this.detectUsageType(line, symbol);
              const context = this.extractLineContext(lines, i);

              usages.push({
                filePath: relativePath,
                line: i + 1,
                context,
                usageType,
              });
            }
          }
        } catch (fileError) {
          logger.warn({ file, error: fileError }, 'Failed to search file');
        }
      }

      logger.info({ usageCount: usages.length, symbol }, 'Completed usage search');
      return usages;
    } catch (error) {
      logger.error({ error, symbol, scope }, 'Failed to find usages');
      throw new Error(`Failed to find usages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find the definition file for a symbol
   */
  private async findSymbolDefinition(symbol: string): Promise<string | null> {
    try {
      // Search GraphRAG for the symbol definition
      const results = await this.graphRAGClient.search(`definition of ${symbol}`, {
        limit: 5,
        domain: 'code',
      });

      if (results.length > 0 && results[0].metadata.file_path) {
        return results[0].metadata.file_path as string;
      }

      // Fallback: search files directly
      const files = await this.findSourceFiles(this.repoPath);

      for (const file of files) {
        const parsed = await this.treeSitterService.parseFile(file);
        if (parsed?.nodes.some((node) => node.name === symbol)) {
          return file.replace(this.repoPath + '/', '');
        }
      }

      return null;
    } catch (error) {
      logger.warn({ error, symbol }, 'Failed to find symbol definition');
      return null;
    }
  }

  /**
   * Query GraphRAG for dependency relationships
   */
  private async queryGraphRAGDependencies(
    symbol: string,
    filePath: string
  ): Promise<Array<{ caller: string; callerFile: string; relationship: string }>> {
    try {
      // Query for CALLED_BY relationships
      const calledByQuery = `What functions or classes call ${symbol} from ${filePath}?`;
      const calledByResults = await this.graphRAGClient.search(calledByQuery, {
        limit: 20,
        domain: 'code',
      });

      // Query for IMPORTED_BY relationships
      const importedByQuery = `What files import ${symbol} from ${filePath}?`;
      const importedByResults = await this.graphRAGClient.search(importedByQuery, {
        limit: 20,
        domain: 'code',
      });

      // Combine and parse results
      const dependencies: Array<{ caller: string; callerFile: string; relationship: string }> = [];

      for (const result of calledByResults) {
        if (result.metadata.caller && result.metadata.caller_file) {
          dependencies.push({
            caller: result.metadata.caller as string,
            callerFile: result.metadata.caller_file as string,
            relationship: 'CALLED_BY',
          });
        }
      }

      for (const result of importedByResults) {
        if (result.metadata.importer && result.metadata.importer_file) {
          dependencies.push({
            caller: result.metadata.importer as string,
            callerFile: result.metadata.importer_file as string,
            relationship: 'IMPORTED_BY',
          });
        }
      }

      logger.debug({ dependencyCount: dependencies.length }, 'Retrieved GraphRAG dependencies');
      return dependencies;
    } catch (error) {
      logger.warn({ error, symbol, filePath }, 'Failed to query GraphRAG dependencies');
      return [];
    }
  }

  /**
   * Build impact graph by traversing dependencies
   */
  private async buildImpactGraph(
    rootSymbol: string,
    rootFile: string,
    directUsages: Usage[],
    graphDependencies: Array<{ caller: string; callerFile: string; relationship: string }>
  ): Promise<Map<string, GraphNode>> {
    const graph = new Map<string, GraphNode>();
    const visited = new Set<string>();
    const queue: Array<{ symbol: string; file: string; depth: number }> = [];

    // Start with direct usages at depth 1
    const directNodes = new Map<string, GraphNode>();
    for (const usage of directUsages) {
      const key = `${usage.filePath}:${usage.usageType}`;
      if (!directNodes.has(key)) {
        directNodes.set(key, {
          symbol: rootSymbol,
          filePath: usage.filePath,
          depth: 1,
          usages: [],
        });
      }
      directNodes.get(key)!.usages.push(usage);
    }

    // Add direct nodes to graph
    for (const [key, node] of directNodes) {
      graph.set(key, node);
      queue.push({ symbol: node.symbol, file: node.filePath, depth: 1 });
    }

    // Add graph dependencies
    for (const dep of graphDependencies) {
      const key = `${dep.callerFile}:${dep.relationship}`;
      if (!graph.has(key)) {
        graph.set(key, {
          symbol: dep.caller,
          filePath: dep.callerFile,
          depth: 1,
          usages: [
            {
              filePath: dep.callerFile,
              line: 0,
              context: `${dep.relationship} relationship from GraphRAG`,
              usageType: dep.relationship === 'CALLED_BY' ? 'call' : 'import',
            },
          ],
        });
        queue.push({ symbol: dep.caller, file: dep.callerFile, depth: 1 });
      }
    }

    // BFS to find indirect impacts (up to depth 3)
    while (queue.length > 0) {
      const current = queue.shift()!;
      const nodeKey = `${current.file}:${current.depth}`;

      if (visited.has(nodeKey) || current.depth >= 3) {
        continue;
      }
      visited.add(nodeKey);

      // Find what calls this symbol
      try {
        const indirectUsages = await this.findUsages(current.symbol, undefined);
        for (const usage of indirectUsages) {
          // Skip self-references and already processed nodes
          if (usage.filePath === rootFile || usage.filePath === current.file) {
            continue;
          }

          const key = `${usage.filePath}:depth${current.depth + 1}`;
          if (!graph.has(key)) {
            graph.set(key, {
              symbol: current.symbol,
              filePath: usage.filePath,
              depth: current.depth + 1,
              usages: [usage],
            });
            queue.push({
              symbol: current.symbol,
              file: usage.filePath,
              depth: current.depth + 1,
            });
          } else {
            graph.get(key)!.usages.push(usage);
          }
        }
      } catch (error) {
        logger.warn({ error, symbol: current.symbol, file: current.file }, 'Failed to traverse node');
      }
    }

    logger.debug({ graphSize: graph.size }, 'Built impact graph');
    return graph;
  }

  /**
   * Rank impacts by severity and calculate scores
   */
  private async rankImpacts(
    impactGraph: Map<string, GraphNode>,
    rootSymbol: string,
    rootFile: string
  ): Promise<ImpactItem[]> {
    const impacts: ImpactItem[] = [];

    for (const [_, node] of impactGraph) {
      // Calculate impact score based on multiple factors
      const baseScore = 100 / Math.pow(2, node.depth - 1); // Exponential decay by depth
      const usageMultiplier = Math.min(node.usages.length, 10) / 10; // Up to 10x for usage frequency
      const criticalityMultiplier = await this.getFileCriticality(node.filePath);

      const impactScore = baseScore * usageMultiplier * criticalityMultiplier;

      // Determine impact level
      const impactLevel = this.determineImpactLevel(impactScore, node.depth, node.filePath);

      // Generate reason
      const reason = this.generateImpactReason(node, impactLevel, rootSymbol);

      impacts.push({
        symbol: node.symbol,
        filePath: node.filePath,
        impactLevel,
        impactScore: Math.round(impactScore * 100) / 100,
        usages: node.usages,
        depth: node.depth,
        reason,
      });
    }

    // Sort by impact score (descending)
    impacts.sort((a, b) => b.impactScore - a.impactScore);

    logger.info({ impactCount: impacts.length, rootSymbol }, 'Ranked impacts');
    return impacts;
  }

  /**
   * Determine criticality of a file (core module vs test vs leaf)
   */
  private async getFileCriticality(filePath: string): Promise<number> {
    // Test files have lower criticality
    if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__')) {
      return 0.3;
    }

    // Config/build files have lower criticality
    if (
      filePath.includes('config') ||
      filePath.includes('.config.') ||
      filePath.includes('webpack') ||
      filePath.includes('vite')
    ) {
      return 0.5;
    }

    // Core/main/index files have higher criticality
    if (
      filePath.includes('core') ||
      filePath.includes('main.') ||
      filePath.includes('index.') ||
      filePath.includes('app.')
    ) {
      return 2.0;
    }

    // API/service files have higher criticality
    if (filePath.includes('api') || filePath.includes('service') || filePath.includes('controller')) {
      return 1.5;
    }

    // Default criticality
    return 1.0;
  }

  /**
   * Determine impact level based on score, depth, and file type
   */
  private determineImpactLevel(score: number, depth: number, filePath: string): ImpactLevel {
    // CRITICAL: Core modules with high score
    if (score >= 80 && depth === 1 && this.isCoreModule(filePath)) {
      return 'CRITICAL';
    }

    // HIGH: Direct callers with moderate-to-high score
    if (score >= 50 && depth === 1) {
      return 'HIGH';
    }

    // MEDIUM: Indirect dependencies or lower-score direct callers
    if (score >= 20 || depth === 2) {
      return 'MEDIUM';
    }

    // LOW: Test files, distant dependencies
    return 'LOW';
  }

  /**
   * Check if file is a core module
   */
  private isCoreModule(filePath: string): boolean {
    return (
      filePath.includes('core') ||
      filePath.includes('main.') ||
      filePath.includes('index.') ||
      filePath.includes('app.') ||
      filePath.includes('server.')
    );
  }

  /**
   * Generate human-readable impact reason
   */
  private generateImpactReason(node: GraphNode, level: ImpactLevel, rootSymbol: string): string {
    const usageCount = node.usages.length;
    const usageTypes = [...new Set(node.usages.map((u) => u.usageType))];

    if (level === 'CRITICAL') {
      return `Core module with ${usageCount} direct ${usageTypes.join('/')} reference(s) to \`${rootSymbol}\`. Changes will require immediate attention.`;
    }

    if (level === 'HIGH') {
      return `Direct caller with ${usageCount} ${usageTypes.join('/')} reference(s) to \`${rootSymbol}\`. Changes will likely break this code.`;
    }

    if (level === 'MEDIUM') {
      return `Indirectly depends on \`${rootSymbol}\` at depth ${node.depth} with ${usageCount} reference(s). Review may be needed.`;
    }

    return `Minimal impact at depth ${node.depth}. ${usageCount} reference(s) found but unlikely to cause issues.`;
  }

  /**
   * Check if a line contains a usage of the symbol
   */
  private isSymbolUsage(line: string, symbol: string): boolean {
    // Remove comments
    const noComments = line.split('//')[0].split('#')[0];

    // Check for various usage patterns
    const patterns = [
      new RegExp(`\\b${symbol}\\s*\\(`), // Function call
      new RegExp(`\\b${symbol}\\s*\\.`), // Method access
      new RegExp(`\\bclass\\s+\\w+\\s+extends\\s+${symbol}`), // Inheritance
      new RegExp(`\\bimport\\s+.*${symbol}`), // Import
      new RegExp(`\\bfrom\\s+.*${symbol}`), // Import from
      new RegExp(`\\b${symbol}\\b`), // General reference
    ];

    return patterns.some((pattern) => pattern.test(noComments));
  }

  /**
   * Detect the type of usage (call, import, inheritance, etc.)
   */
  private detectUsageType(line: string, symbol: string): Usage['usageType'] {
    if (/\bimport\s+/.test(line) || /\bfrom\s+/.test(line)) {
      return 'import';
    }
    if (/\bextends\s+/.test(line) || /\bimplements\s+/.test(line)) {
      return 'inheritance';
    }
    if (new RegExp(`${symbol}\\s*\\(`).test(line)) {
      return 'call';
    }
    return 'reference';
  }

  /**
   * Extract context around a line (3 lines before and after)
   */
  private extractLineContext(lines: string[], lineIndex: number): string {
    const start = Math.max(0, lineIndex - 1);
    const end = Math.min(lines.length, lineIndex + 2);
    return lines.slice(start, end).join('\n');
  }

  /**
   * Recursively find all source files in a directory
   */
  private async findSourceFiles(rootPath: string): Promise<string[]> {
    const files: string[] = [];
    const supportedExtensions = ['.ts', '.js', '.py', '.go', '.rs', '.java'];
    const ignoreDirs = ['node_modules', 'dist', 'build', '.git', 'target', '__pycache__', '.next'];

    async function walk(dir: string): Promise<void> {
      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (entry.isDirectory()) {
            // Skip ignored directories
            if (!ignoreDirs.includes(entry.name)) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            // Check if file has supported extension
            const ext = extname(entry.name);
            if (supportedExtensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        logger.warn({ dir, error }, 'Failed to read directory');
      }
    }

    await walk(rootPath);
    return files;
  }
}
