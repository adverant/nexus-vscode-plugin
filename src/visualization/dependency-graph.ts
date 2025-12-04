// src/visualization/dependency-graph.ts
/**
 * NexusMind Dependency Graph Builder
 *
 * Builds interactive dependency graphs from codebase analysis.
 * Integrates Tree-sitter AST parsing with GraphRAG relationships.
 */

import {
  Graph,
  GraphNode,
  GraphEdge,
  DependencyGraphOptions,
  DependencyGraphFilters,
  NodeType,
  EdgeType,
  LayoutType,
} from './types.js';
import { GraphBuilder, GraphAnalyzer, createNode, createEdge } from './graph-engine.js';
import { applyLayout } from './layout-algorithms.js';
import { GraphRAGClient } from '../clients/graphrag-client.js';
import { TreeSitterService } from '../parsers/tree-sitter-service.js';
import { ParsedFile, ASTNode, ImportNode, ExportNode } from '../types.js';
import pino from 'pino';
import { readdir, stat } from 'fs/promises';
import { join, relative, extname, dirname, basename } from 'path';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============================================================================
// Dependency Graph Builder
// ============================================================================

export class DependencyGraphBuilder {
  private graphBuilder: GraphBuilder;
  private parsedFiles: Map<string, ParsedFile> = new Map();
  private fileToNodeId: Map<string, string> = new Map();

  constructor(
    private graphRAGClient: GraphRAGClient,
    private treeSitterService: TreeSitterService,
    private repoPath: string
  ) {
    this.graphBuilder = new GraphBuilder();
  }

  /**
   * Build dependency graph for a repository or subtree
   */
  async buildGraph(options: DependencyGraphOptions): Promise<Graph> {
    const startTime = Date.now();
    logger.info({ rootFile: options.rootFile, depth: options.depth }, 'Building dependency graph');

    try {
      // Step 1: Discover and parse files
      const files = await this.discoverFiles(options.rootFile, options.filters);
      logger.debug({ fileCount: files.length }, 'Discovered files');

      // Step 2: Parse all files with Tree-sitter
      await this.parseFiles(files);
      logger.debug({ parsedCount: this.parsedFiles.size }, 'Parsed files');

      // Step 3: Build file nodes
      this.buildFileNodes(options.filters);

      // Step 4: Build symbol nodes (functions, classes, etc.)
      if (options.filters.nodeTypes.some((t) => t !== 'file' && t !== 'module')) {
        this.buildSymbolNodes(options.filters);
      }

      // Step 5: Build edges from imports/exports
      await this.buildEdges(options);

      // Step 6: Enrich with GraphRAG data
      await this.enrichWithGraphRAG(options);

      // Step 7: Apply filters
      const graph = this.applyFilters(this.graphBuilder.build(), options.filters);

      // Step 8: Apply layout
      const layoutedGraph = applyLayout(
        graph,
        options.layout,
        { width: 1600, height: 1200 },
        options.rootFile
      );

      // Step 9: Update metadata
      layoutedGraph.metadata.rootFile = options.rootFile;
      layoutedGraph.metadata.generatedAt = new Date();

      const duration = Date.now() - startTime;
      logger.info(
        {
          nodeCount: layoutedGraph.nodes.length,
          edgeCount: layoutedGraph.edges.length,
          duration,
        },
        'Dependency graph built'
      );

      return layoutedGraph;
    } catch (error) {
      logger.error({ error, options }, 'Failed to build dependency graph');
      throw new Error(
        `Failed to build dependency graph: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Discover source files in the repository
   */
  private async discoverFiles(rootPath: string, filters: DependencyGraphFilters): Promise<string[]> {
    const files: string[] = [];
    const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'];
    const ignoreDirs = ['node_modules', 'dist', 'build', '.git', 'target', '__pycache__', '.next', 'vendor'];

    const absoluteRoot = rootPath.startsWith('/')
      ? rootPath
      : join(this.repoPath, rootPath);

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          const relativePath = relative(this.repoPath, fullPath);

          // Check exclude patterns
          if (filters.excludePatterns?.some((p) => relativePath.includes(p))) {
            continue;
          }

          if (entry.isDirectory()) {
            if (!ignoreDirs.includes(entry.name)) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = extname(entry.name);
            if (supportedExtensions.includes(ext)) {
              // Check include patterns if specified
              if (
                !filters.includePatterns ||
                filters.includePatterns.length === 0 ||
                filters.includePatterns.some((p) => relativePath.includes(p))
              ) {
                files.push(fullPath);
              }
            }
          }
        }
      } catch (error) {
        logger.warn({ dir, error }, 'Failed to read directory');
      }
    };

    // Check if root is a file or directory
    try {
      const rootStat = await stat(absoluteRoot);
      if (rootStat.isFile()) {
        files.push(absoluteRoot);
      } else {
        await walk(absoluteRoot);
      }
    } catch {
      // Try as relative path
      const relativePath = join(this.repoPath, rootPath);
      const relStat = await stat(relativePath);
      if (relStat.isFile()) {
        files.push(relativePath);
      } else {
        await walk(relativePath);
      }
    }

    return files;
  }

  /**
   * Parse files with Tree-sitter
   */
  private async parseFiles(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        const parsed = await this.treeSitterService.parseFile(file);
        if (parsed) {
          const relativePath = relative(this.repoPath, file);
          this.parsedFiles.set(relativePath, parsed);
        }
      } catch (error) {
        logger.warn({ file, error }, 'Failed to parse file');
      }
    }
  }

  /**
   * Build file-level nodes
   */
  private buildFileNodes(filters: DependencyGraphFilters): void {
    if (!filters.nodeTypes.includes('file') && !filters.nodeTypes.includes('module')) {
      return;
    }

    for (const [filePath, parsed] of this.parsedFiles) {
      const nodeId = this.generateNodeId('file', filePath);
      this.fileToNodeId.set(filePath, nodeId);

      const node = createNode({
        id: nodeId,
        type: 'file',
        name: basename(filePath),
        path: filePath,
        language: parsed.language,
        metrics: {
          complexity: this.calculateFileComplexity(parsed),
          changeFrequency: 0, // Will be enriched later
          impactScore: 0, // Will be calculated
          linesOfCode: parsed.nodes.reduce(
            (sum, n) => sum + (n.endLine - n.startLine + 1),
            0
          ),
        },
      });

      this.graphBuilder.addNode(node);
    }
  }

  /**
   * Build symbol-level nodes (functions, classes, etc.)
   */
  private buildSymbolNodes(filters: DependencyGraphFilters): void {
    for (const [filePath, parsed] of this.parsedFiles) {
      const fileNodeId = this.fileToNodeId.get(filePath);

      for (const astNode of parsed.nodes) {
        const nodeType = this.mapASTTypeToNodeType(astNode.type);
        if (!filters.nodeTypes.includes(nodeType)) {
          continue;
        }

        const nodeId = this.generateNodeId(nodeType, `${filePath}:${astNode.name}`);

        const node = createNode({
          id: nodeId,
          type: nodeType,
          name: astNode.name,
          path: filePath,
          startLine: astNode.startLine,
          endLine: astNode.endLine,
          language: parsed.language,
          parentId: fileNodeId,
          metrics: {
            complexity: astNode.endLine - astNode.startLine,
            changeFrequency: 0,
            impactScore: 0,
            linesOfCode: astNode.endLine - astNode.startLine + 1,
          },
        });

        this.graphBuilder.addNode(node);

        // Add contains edge from file to symbol
        if (fileNodeId && filters.edgeTypes.includes('contains')) {
          this.graphBuilder.addEdge(
            createEdge({
              source: fileNodeId,
              target: nodeId,
              type: 'contains',
            })
          );
        }
      }
    }
  }

  /**
   * Build edges from import/export relationships
   */
  private async buildEdges(options: DependencyGraphOptions): Promise<void> {
    for (const [filePath, parsed] of this.parsedFiles) {
      const sourceFileId = this.fileToNodeId.get(filePath);
      if (!sourceFileId) continue;

      // Process imports
      if (options.filters.edgeTypes.includes('imports')) {
        for (const importNode of parsed.imports) {
          const targetPath = this.resolveImportPath(filePath, importNode.source);
          if (!targetPath) continue;

          const targetFileId = this.fileToNodeId.get(targetPath);
          if (!targetFileId && !options.includeExternal) continue;

          if (targetFileId) {
            this.graphBuilder.addEdge(
              createEdge({
                source: sourceFileId,
                target: targetFileId,
                type: 'imports',
                lineNumber: importNode.line,
              })
            );
          }
        }
      }
    }

    // Build call edges by analyzing AST patterns
    if (options.filters.edgeTypes.includes('calls')) {
      await this.buildCallEdges();
    }

    // Build inheritance edges
    if (options.filters.edgeTypes.includes('extends') || options.filters.edgeTypes.includes('implements')) {
      await this.buildInheritanceEdges(options.filters);
    }
  }

  /**
   * Build call relationship edges
   */
  private async buildCallEdges(): Promise<void> {
    // This would require deeper AST analysis
    // For now, we rely on GraphRAG relationships
    logger.debug('Call edge extraction delegated to GraphRAG enrichment');
  }

  /**
   * Build inheritance edges (extends/implements)
   */
  private async buildInheritanceEdges(filters: DependencyGraphFilters): Promise<void> {
    // This would require deeper AST analysis for class hierarchies
    logger.debug('Inheritance edge extraction delegated to GraphRAG enrichment');
  }

  /**
   * Enrich graph with GraphRAG relationship data
   */
  private async enrichWithGraphRAG(options: DependencyGraphOptions): Promise<void> {
    try {
      // Query GraphRAG for relationships
      const query = `relationships between files and functions in ${options.rootFile}`;
      const results = await this.graphRAGClient.search(query, {
        limit: 100,
        domain: 'code',
      });

      for (const result of results) {
        const metadata = result.metadata;

        // Extract relationship information from GraphRAG results
        if (metadata.source_file && metadata.target_file && metadata.relationship_type) {
          const sourceId = this.fileToNodeId.get(metadata.source_file as string);
          const targetId = this.fileToNodeId.get(metadata.target_file as string);

          if (sourceId && targetId) {
            const edgeType = this.mapRelationshipType(metadata.relationship_type as string);
            if (options.filters.edgeTypes.includes(edgeType)) {
              this.graphBuilder.addEdge(
                createEdge({
                  source: sourceId,
                  target: targetId,
                  type: edgeType,
                  weight: result.score,
                })
              );
            }
          }
        }

        // Enrich node metrics
        if (metadata.file_path && metadata.change_frequency) {
          const nodeId = this.fileToNodeId.get(metadata.file_path as string);
          if (nodeId) {
            const node = this.graphBuilder.getNode(nodeId);
            if (node) {
              node.metrics.changeFrequency = metadata.change_frequency as number;
            }
          }
        }
      }

      logger.debug({ resultCount: results.length }, 'Enriched with GraphRAG data');
    } catch (error) {
      logger.warn({ error }, 'Failed to enrich with GraphRAG data');
    }
  }

  /**
   * Apply filters to the built graph
   */
  private applyFilters(graph: Graph, filters: DependencyGraphFilters): Graph {
    let filteredNodes = graph.nodes;
    let filteredEdges = graph.edges;

    // Filter by node types
    filteredNodes = filteredNodes.filter((n) => filters.nodeTypes.includes(n.type));

    // Filter by impact threshold
    if (filters.impactThreshold !== undefined) {
      filteredNodes = filteredNodes.filter(
        (n) => n.metrics.impactScore >= filters.impactThreshold!
      );
    }

    // Filter by vulnerability status
    if (filters.vulnerabilityFilter && filters.vulnerabilityFilter !== 'all') {
      if (filters.vulnerabilityFilter === 'affected') {
        filteredNodes = filteredNodes.filter((n) => n.vulnerabilities.length > 0);
      } else if (filters.vulnerabilityFilter === 'clean') {
        filteredNodes = filteredNodes.filter((n) => n.vulnerabilities.length === 0);
      }
    }

    // Get valid node IDs
    const validNodeIds = new Set(filteredNodes.map((n) => n.id));

    // Filter edges to only include those between valid nodes
    filteredEdges = filteredEdges.filter(
      (e) =>
        validNodeIds.has(e.source) &&
        validNodeIds.has(e.target) &&
        filters.edgeTypes.includes(e.type)
    );

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      metadata: {
        ...graph.metadata,
        totalNodes: filteredNodes.length,
        totalEdges: filteredEdges.length,
      },
    };
  }

  /**
   * Resolve import path to actual file path
   */
  private resolveImportPath(fromFile: string, importSource: string): string | null {
    // Skip external modules
    if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
      return null;
    }

    const fromDir = dirname(fromFile);
    let resolvedPath = join(fromDir, importSource);

    // Try various extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];

    for (const ext of extensions) {
      const fullPath = resolvedPath + ext;
      if (this.parsedFiles.has(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }

  /**
   * Generate unique node ID
   */
  private generateNodeId(type: string, identifier: string): string {
    return `${type}:${identifier}`.replace(/[^a-zA-Z0-9:._-]/g, '_');
  }

  /**
   * Map AST node type to graph node type
   */
  private mapASTTypeToNodeType(astType: string): NodeType {
    switch (astType) {
      case 'class':
        return 'class';
      case 'function':
        return 'function';
      case 'method':
        return 'method';
      case 'interface':
        return 'interface';
      case 'variable':
        return 'variable';
      default:
        return 'function';
    }
  }

  /**
   * Map GraphRAG relationship type to edge type
   */
  private mapRelationshipType(relationshipType: string): EdgeType {
    const mapping: Record<string, EdgeType> = {
      CALLS: 'calls',
      IMPORTS: 'imports',
      EXTENDS: 'extends',
      IMPLEMENTS: 'implements',
      CONTAINS: 'contains',
      REFERENCES: 'references',
      CALLED_BY: 'calls',
      IMPORTED_BY: 'imports',
    };
    return mapping[relationshipType.toUpperCase()] || 'references';
  }

  /**
   * Calculate file complexity from AST
   */
  private calculateFileComplexity(parsed: ParsedFile): number {
    // Simple complexity: number of functions + classes + nesting depth
    let complexity = 0;

    for (const node of parsed.nodes) {
      if (node.type === 'function' || node.type === 'method') {
        complexity += 1;
      } else if (node.type === 'class') {
        complexity += 2;
      }
    }

    // Add complexity for imports (coupling)
    complexity += parsed.imports.length * 0.5;

    return Math.round(complexity * 10) / 10;
  }
}

// ============================================================================
// Default Filter Factory
// ============================================================================

export function createDefaultFilters(): DependencyGraphFilters {
  return {
    nodeTypes: ['file', 'function', 'class'],
    edgeTypes: ['imports', 'calls', 'extends'],
    impactThreshold: 0,
    vulnerabilityFilter: 'all',
    excludePatterns: ['node_modules', 'dist', 'build', '.test.', '.spec.', '__tests__'],
    includePatterns: [],
  };
}

export function createDefaultOptions(rootFile: string): DependencyGraphOptions {
  return {
    rootFile,
    depth: 5,
    includeExternal: false,
    layout: 'force',
    filters: createDefaultFilters(),
  };
}
