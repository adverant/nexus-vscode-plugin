// src/visualization/graph-engine.ts
/**
 * NexusMind Graph Engine
 *
 * Core graph data structures and algorithms for code visualization.
 * Provides efficient graph manipulation, traversal, and analysis.
 */

import {
  Graph,
  GraphNode,
  GraphEdge,
  NodeType,
  EdgeType,
  Position,
  NodeMetrics,
  ImpactSeverity,
} from './types.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============================================================================
// Graph Builder
// ============================================================================

export class GraphBuilder {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();
  private reverseAdjacencyList: Map<string, Set<string>> = new Map();

  /**
   * Add a node to the graph
   */
  addNode(node: GraphNode): this {
    if (this.nodes.has(node.id)) {
      logger.debug({ nodeId: node.id }, 'Node already exists, updating');
    }
    this.nodes.set(node.id, node);

    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, new Set());
    }
    if (!this.reverseAdjacencyList.has(node.id)) {
      this.reverseAdjacencyList.set(node.id, new Set());
    }

    return this;
  }

  /**
   * Add an edge to the graph
   */
  addEdge(edge: GraphEdge): this {
    const edgeId = edge.id || `${edge.source}-${edge.type}-${edge.target}`;
    edge.id = edgeId;

    if (this.edges.has(edgeId)) {
      const existing = this.edges.get(edgeId)!;
      existing.weight += edge.weight;
      if (existing.metadata && edge.metadata?.count) {
        existing.metadata.count = (existing.metadata.count || 0) + edge.metadata.count;
      }
      return this;
    }

    this.edges.set(edgeId, edge);

    // Update adjacency lists
    if (!this.adjacencyList.has(edge.source)) {
      this.adjacencyList.set(edge.source, new Set());
    }
    this.adjacencyList.get(edge.source)!.add(edge.target);

    if (!this.reverseAdjacencyList.has(edge.target)) {
      this.reverseAdjacencyList.set(edge.target, new Set());
    }
    this.reverseAdjacencyList.get(edge.target)!.add(edge.source);

    return this;
  }

  /**
   * Get all neighbors of a node
   */
  getNeighbors(nodeId: string): string[] {
    return Array.from(this.adjacencyList.get(nodeId) || []);
  }

  /**
   * Get all nodes that point to this node
   */
  getIncomingNeighbors(nodeId: string): string[] {
    return Array.from(this.reverseAdjacencyList.get(nodeId) || []);
  }

  /**
   * Get edges between two nodes
   */
  getEdgesBetween(sourceId: string, targetId: string): GraphEdge[] {
    return Array.from(this.edges.values()).filter(
      (e) =>
        (e.source === sourceId && e.target === targetId) ||
        (e.source === targetId && e.target === sourceId)
    );
  }

  /**
   * Check if graph has node
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): GraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Build the final graph
   */
  build(): Graph {
    const nodes = Array.from(this.nodes.values());
    const edges = Array.from(this.edges.values());

    // Calculate max depth via BFS from root nodes
    let maxDepth = 0;
    const rootNodes = nodes.filter((n) => !n.parentId);
    for (const root of rootNodes) {
      const depth = this.calculateDepth(root.id);
      maxDepth = Math.max(maxDepth, depth);
    }

    return {
      nodes,
      edges,
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        maxDepth,
        generatedAt: new Date(),
      },
    };
  }

  /**
   * Calculate depth from a node using BFS
   */
  private calculateDepth(startId: string): number {
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    let maxDepth = 0;

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      maxDepth = Math.max(maxDepth, depth);

      for (const neighbor of this.getNeighbors(id)) {
        if (!visited.has(neighbor)) {
          queue.push({ id: neighbor, depth: depth + 1 });
        }
      }
    }

    return maxDepth;
  }
}

// ============================================================================
// Graph Analyzer
// ============================================================================

export class GraphAnalyzer {
  private graph: Graph;
  private adjacencyList: Map<string, Set<string>>;
  private reverseAdjacencyList: Map<string, Set<string>>;

  constructor(graph: Graph) {
    this.graph = graph;
    this.adjacencyList = new Map();
    this.reverseAdjacencyList = new Map();
    this.buildAdjacencyLists();
  }

  private buildAdjacencyLists(): void {
    for (const node of this.graph.nodes) {
      this.adjacencyList.set(node.id, new Set());
      this.reverseAdjacencyList.set(node.id, new Set());
    }

    for (const edge of this.graph.edges) {
      this.adjacencyList.get(edge.source)?.add(edge.target);
      this.reverseAdjacencyList.get(edge.target)?.add(edge.source);
    }
  }

  /**
   * Find all nodes reachable from a starting node within depth limit
   */
  findReachable(startId: string, maxDepth: number): Map<string, number> {
    const depths = new Map<string, number>();
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (depths.has(id) || depth > maxDepth) continue;
      depths.set(id, depth);

      for (const neighbor of this.adjacencyList.get(id) || []) {
        if (!depths.has(neighbor)) {
          queue.push({ id: neighbor, depth: depth + 1 });
        }
      }
    }

    return depths;
  }

  /**
   * Find all nodes that can reach the target node (reverse reachability)
   */
  findDependents(targetId: string, maxDepth: number): Map<string, number> {
    const depths = new Map<string, number>();
    const queue: Array<{ id: string; depth: number }> = [{ id: targetId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (depths.has(id) || depth > maxDepth) continue;
      depths.set(id, depth);

      for (const dependent of this.reverseAdjacencyList.get(id) || []) {
        if (!depths.has(dependent)) {
          queue.push({ id: dependent, depth: depth + 1 });
        }
      }
    }

    return depths;
  }

  /**
   * Detect circular dependencies
   */
  findCircularDependencies(): Array<string[]> {
    const cycles: Array<string[]> = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      for (const neighbor of this.adjacencyList.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          cycles.push(path.slice(cycleStart));
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
    };

    for (const node of this.graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycles;
  }

  /**
   * Calculate PageRank-style importance scores
   */
  calculateImportanceScores(dampingFactor = 0.85, iterations = 20): Map<string, number> {
    const scores = new Map<string, number>();
    const nodeCount = this.graph.nodes.length;

    // Initialize scores
    for (const node of this.graph.nodes) {
      scores.set(node.id, 1 / nodeCount);
    }

    // Iterate
    for (let i = 0; i < iterations; i++) {
      const newScores = new Map<string, number>();

      for (const node of this.graph.nodes) {
        let incomingScore = 0;
        const incomingNodes = this.reverseAdjacencyList.get(node.id) || new Set();

        for (const incoming of incomingNodes) {
          const outgoingCount = (this.adjacencyList.get(incoming) || new Set()).size;
          if (outgoingCount > 0) {
            incomingScore += (scores.get(incoming) || 0) / outgoingCount;
          }
        }

        newScores.set(node.id, (1 - dampingFactor) / nodeCount + dampingFactor * incomingScore);
      }

      // Update scores
      for (const [id, score] of newScores) {
        scores.set(id, score);
      }
    }

    return scores;
  }

  /**
   * Find strongly connected components using Tarjan's algorithm
   */
  findStronglyConnectedComponents(): Array<string[]> {
    const components: Array<string[]> = [];
    const index = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    let currentIndex = 0;

    const strongConnect = (nodeId: string): void => {
      index.set(nodeId, currentIndex);
      lowlink.set(nodeId, currentIndex);
      currentIndex++;
      stack.push(nodeId);
      onStack.add(nodeId);

      for (const neighbor of this.adjacencyList.get(nodeId) || []) {
        if (!index.has(neighbor)) {
          strongConnect(neighbor);
          lowlink.set(nodeId, Math.min(lowlink.get(nodeId)!, lowlink.get(neighbor)!));
        } else if (onStack.has(neighbor)) {
          lowlink.set(nodeId, Math.min(lowlink.get(nodeId)!, index.get(neighbor)!));
        }
      }

      if (lowlink.get(nodeId) === index.get(nodeId)) {
        const component: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          component.push(w);
        } while (w !== nodeId);

        if (component.length > 1) {
          components.push(component);
        }
      }
    };

    for (const node of this.graph.nodes) {
      if (!index.has(node.id)) {
        strongConnect(node.id);
      }
    }

    return components;
  }

  /**
   * Calculate betweenness centrality (simplified)
   */
  calculateBetweennessCentrality(): Map<string, number> {
    const centrality = new Map<string, number>();
    const nodeIds = this.graph.nodes.map((n) => n.id);

    // Initialize
    for (const id of nodeIds) {
      centrality.set(id, 0);
    }

    // For each pair of nodes, find shortest paths
    for (const source of nodeIds) {
      const paths = this.findShortestPaths(source);

      for (const [target, path] of paths) {
        if (path.length > 2) {
          // Intermediate nodes
          for (let i = 1; i < path.length - 1; i++) {
            centrality.set(path[i], (centrality.get(path[i]) || 0) + 1);
          }
        }
      }
    }

    // Normalize
    const maxCentrality = Math.max(...centrality.values());
    if (maxCentrality > 0) {
      for (const [id, value] of centrality) {
        centrality.set(id, value / maxCentrality);
      }
    }

    return centrality;
  }

  /**
   * Find shortest paths from a source using BFS
   */
  private findShortestPaths(sourceId: string): Map<string, string[]> {
    const paths = new Map<string, string[]>();
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [{ id: sourceId, path: [sourceId] }];

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;

      if (visited.has(id)) continue;
      visited.add(id);
      paths.set(id, path);

      for (const neighbor of this.adjacencyList.get(id) || []) {
        if (!visited.has(neighbor)) {
          queue.push({ id: neighbor, path: [...path, neighbor] });
        }
      }
    }

    return paths;
  }

  /**
   * Get graph statistics
   */
  getStatistics(): {
    nodeCount: number;
    edgeCount: number;
    density: number;
    avgDegree: number;
    maxDegree: number;
    connectedComponents: number;
    hasCycles: boolean;
  } {
    const nodeCount = this.graph.nodes.length;
    const edgeCount = this.graph.edges.length;
    const maxPossibleEdges = nodeCount * (nodeCount - 1);
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

    let totalDegree = 0;
    let maxDegree = 0;

    for (const nodeId of this.adjacencyList.keys()) {
      const outDegree = (this.adjacencyList.get(nodeId) || new Set()).size;
      const inDegree = (this.reverseAdjacencyList.get(nodeId) || new Set()).size;
      const degree = outDegree + inDegree;
      totalDegree += degree;
      maxDegree = Math.max(maxDegree, degree);
    }

    const avgDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
    const cycles = this.findCircularDependencies();

    return {
      nodeCount,
      edgeCount,
      density,
      avgDegree,
      maxDegree,
      connectedComponents: this.countConnectedComponents(),
      hasCycles: cycles.length > 0,
    };
  }

  /**
   * Count connected components (undirected)
   */
  private countConnectedComponents(): number {
    const visited = new Set<string>();
    let components = 0;

    const dfs = (nodeId: string): void => {
      visited.add(nodeId);
      for (const neighbor of this.adjacencyList.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      }
      for (const neighbor of this.reverseAdjacencyList.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      }
    };

    for (const node of this.graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
        components++;
      }
    }

    return components;
  }
}

// ============================================================================
// Node Factory
// ============================================================================

export function createNode(params: {
  id: string;
  type: NodeType;
  name: string;
  path: string;
  metrics?: Partial<NodeMetrics>;
  startLine?: number;
  endLine?: number;
  language?: string;
  parentId?: string;
}): GraphNode {
  return {
    id: params.id,
    type: params.type,
    name: params.name,
    path: params.path,
    metrics: {
      complexity: params.metrics?.complexity ?? 0,
      changeFrequency: params.metrics?.changeFrequency ?? 0,
      impactScore: params.metrics?.impactScore ?? 0,
      testCoverage: params.metrics?.testCoverage,
      linesOfCode: params.metrics?.linesOfCode,
      cyclomaticComplexity: params.metrics?.cyclomaticComplexity,
    },
    vulnerabilities: [],
    startLine: params.startLine,
    endLine: params.endLine,
    language: params.language,
    parentId: params.parentId,
    children: [],
  };
}

export function createEdge(params: {
  source: string;
  target: string;
  type: EdgeType;
  weight?: number;
  lineNumber?: number;
  isCircular?: boolean;
}): GraphEdge {
  return {
    id: `${params.source}-${params.type}-${params.target}`,
    source: params.source,
    target: params.target,
    type: params.type,
    weight: params.weight ?? 1,
    metadata: {
      lineNumber: params.lineNumber,
      isCircular: params.isCircular,
      count: 1,
    },
  };
}

// ============================================================================
// Impact Severity Calculation
// ============================================================================

export function calculateImpactSeverity(
  impactScore: number,
  depth: number,
  isCoreModule: boolean
): ImpactSeverity {
  if (impactScore >= 80 && depth === 1 && isCoreModule) {
    return 'critical';
  }
  if (impactScore >= 50 && depth <= 2) {
    return 'high';
  }
  if (impactScore >= 20 || depth <= 3) {
    return 'medium';
  }
  if (impactScore > 0) {
    return 'low';
  }
  return 'none';
}

export function isCoreModule(filePath: string): boolean {
  const corePatterns = [
    'index.',
    'main.',
    'app.',
    'server.',
    '/core/',
    '/lib/',
    '/services/',
    '/api/',
  ];
  return corePatterns.some((pattern) => filePath.includes(pattern));
}
