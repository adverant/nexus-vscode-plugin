// src/__tests__/unit/visualization.test.ts
/**
 * Unit tests for the NexusMind Visualization Module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GraphBuilder,
  GraphAnalyzer,
  createNode,
  createEdge,
  calculateImpactSeverity,
  isCoreModule,
} from '../../visualization/graph-engine.js';
import {
  forceDirectedLayout,
  hierarchicalLayout,
  radialLayout,
  organicLayout,
  applyLayout,
} from '../../visualization/layout-algorithms.js';
import type {
  Graph,
  NodeType,
  LayoutType,
} from '../../visualization/types.js';

// ============================================================================
// Graph Engine Tests
// ============================================================================

describe('GraphBuilder', () => {
  let builder: GraphBuilder;

  beforeEach(() => {
    builder = new GraphBuilder();
  });

  describe('addNode', () => {
    it('should add a node to the graph', () => {
      const node = createNode({
        id: 'node1',
        type: 'file',
        name: 'test.ts',
        path: '/src/test.ts',
      });
      builder.addNode(node);

      const graph = builder.build();
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0].id).toBe('node1');
    });

    it('should update existing node when adding duplicate', () => {
      const node1 = createNode({
        id: 'node1',
        type: 'file',
        name: 'test.ts',
        path: '/src/test.ts',
      });
      const node2 = createNode({
        id: 'node1',
        type: 'file',
        name: 'test-updated.ts',
        path: '/src/test.ts',
      });

      builder.addNode(node1);
      builder.addNode(node2);

      const graph = builder.build();
      expect(graph.nodes).toHaveLength(1);
      expect(graph.nodes[0].name).toBe('test-updated.ts');
    });

    it('should support different node types', () => {
      const nodeTypes: NodeType[] = ['file', 'function', 'class', 'method', 'module'];

      nodeTypes.forEach((type, idx) => {
        builder.addNode(
          createNode({
            id: `node${idx}`,
            type,
            name: `name${idx}`,
            path: `/path${idx}`,
          })
        );
      });

      const graph = builder.build();
      expect(graph.nodes).toHaveLength(5);

      const types = new Set(graph.nodes.map((n) => n.type));
      expect(types.size).toBe(5);
    });
  });

  describe('addEdge', () => {
    it('should add an edge between nodes', () => {
      builder.addNode(createNode({ id: 'node1', type: 'file', name: 'a.ts', path: '/a.ts' }));
      builder.addNode(createNode({ id: 'node2', type: 'file', name: 'b.ts', path: '/b.ts' }));
      builder.addEdge(createEdge({ source: 'node1', target: 'node2', type: 'imports' }));

      const graph = builder.build();
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0].source).toBe('node1');
      expect(graph.edges[0].target).toBe('node2');
    });

    it('should handle different edge types', () => {
      builder.addNode(createNode({ id: 'node1', type: 'file', name: 'a.ts', path: '/a.ts' }));
      builder.addNode(createNode({ id: 'node2', type: 'class', name: 'ClassA', path: '/a.ts' }));
      builder.addNode(createNode({ id: 'node3', type: 'class', name: 'ClassB', path: '/b.ts' }));
      builder.addNode(createNode({ id: 'node4', type: 'function', name: 'funcA', path: '/a.ts' }));

      builder.addEdge(createEdge({ source: 'node1', target: 'node2', type: 'imports' }));
      builder.addEdge(createEdge({ source: 'node2', target: 'node3', type: 'extends' }));
      builder.addEdge(createEdge({ source: 'node3', target: 'node4', type: 'calls' }));
      builder.addEdge(createEdge({ source: 'node4', target: 'node1', type: 'implements' }));

      const graph = builder.build();
      const types = new Set(graph.edges.map((e) => e.type));
      expect(types.size).toBe(4);
    });

    it('should merge duplicate edges by increasing weight', () => {
      builder.addNode(createNode({ id: 'node1', type: 'file', name: 'a.ts', path: '/a.ts' }));
      builder.addNode(createNode({ id: 'node2', type: 'file', name: 'b.ts', path: '/b.ts' }));

      builder.addEdge(createEdge({ source: 'node1', target: 'node2', type: 'imports' }));
      builder.addEdge(createEdge({ source: 'node1', target: 'node2', type: 'imports' }));

      const graph = builder.build();
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0].weight).toBe(2); // Weight should be combined
    });
  });

  describe('build', () => {
    it('should return empty graph when no nodes added', () => {
      const graph = builder.build();
      expect(graph.nodes).toHaveLength(0);
      expect(graph.edges).toHaveLength(0);
    });

    it('should include metadata in built graph', () => {
      builder.addNode(createNode({ id: 'node1', type: 'file', name: 'test.ts', path: '/test.ts' }));
      const graph = builder.build();

      expect(graph.metadata).toBeDefined();
      expect(graph.metadata.totalNodes).toBe(1);
      expect(graph.metadata.totalEdges).toBe(0);
    });
  });

  describe('getNeighbors', () => {
    it('should return neighboring nodes', () => {
      builder.addNode(createNode({ id: 'a', type: 'file', name: 'a.ts', path: '/a.ts' }));
      builder.addNode(createNode({ id: 'b', type: 'file', name: 'b.ts', path: '/b.ts' }));
      builder.addNode(createNode({ id: 'c', type: 'file', name: 'c.ts', path: '/c.ts' }));

      builder.addEdge(createEdge({ source: 'a', target: 'b', type: 'imports' }));
      builder.addEdge(createEdge({ source: 'a', target: 'c', type: 'imports' }));

      const neighbors = builder.getNeighbors('a');
      expect(neighbors).toHaveLength(2);
      expect(neighbors).toContain('b');
      expect(neighbors).toContain('c');
    });
  });

  describe('hasNode', () => {
    it('should return true for existing nodes', () => {
      builder.addNode(createNode({ id: 'node1', type: 'file', name: 'test.ts', path: '/test.ts' }));
      expect(builder.hasNode('node1')).toBe(true);
    });

    it('should return false for non-existent nodes', () => {
      expect(builder.hasNode('nonexistent')).toBe(false);
    });
  });
});

describe('GraphAnalyzer', () => {
  let analyzer: GraphAnalyzer;
  let testGraph: Graph;

  beforeEach(() => {
    // Create a test graph with some nodes and edges
    const builder = new GraphBuilder();

    // Add nodes
    builder.addNode(createNode({ id: 'a', type: 'file', name: 'a.ts', path: '/a.ts' }));
    builder.addNode(createNode({ id: 'b', type: 'file', name: 'b.ts', path: '/b.ts' }));
    builder.addNode(createNode({ id: 'c', type: 'file', name: 'c.ts', path: '/c.ts' }));
    builder.addNode(createNode({ id: 'd', type: 'file', name: 'd.ts', path: '/d.ts' }));

    // Add edges (a -> b -> c -> a forms a cycle, d is isolated)
    builder.addEdge(createEdge({ source: 'a', target: 'b', type: 'imports' }));
    builder.addEdge(createEdge({ source: 'b', target: 'c', type: 'imports' }));
    builder.addEdge(createEdge({ source: 'c', target: 'a', type: 'imports' }));

    testGraph = builder.build();
    analyzer = new GraphAnalyzer(testGraph);
  });

  describe('findCircularDependencies', () => {
    it('should detect circular dependencies', () => {
      const cycles = analyzer.findCircularDependencies();
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should return empty array for acyclic graph', () => {
      const builder = new GraphBuilder();
      builder.addNode(createNode({ id: 'a', type: 'file', name: 'a.ts', path: '/a.ts' }));
      builder.addNode(createNode({ id: 'b', type: 'file', name: 'b.ts', path: '/b.ts' }));
      builder.addNode(createNode({ id: 'c', type: 'file', name: 'c.ts', path: '/c.ts' }));
      builder.addEdge(createEdge({ source: 'a', target: 'b', type: 'imports' }));
      builder.addEdge(createEdge({ source: 'b', target: 'c', type: 'imports' }));

      const acyclicGraph = builder.build();
      const acyclicAnalyzer = new GraphAnalyzer(acyclicGraph);
      const cycles = acyclicAnalyzer.findCircularDependencies();

      expect(cycles.length).toBe(0);
    });
  });

  describe('calculateImportanceScores', () => {
    it('should calculate importance scores for all nodes', () => {
      const scores = analyzer.calculateImportanceScores();

      expect(scores.size).toBe(testGraph.nodes.length);
      for (const score of scores.values()) {
        expect(score).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('findStronglyConnectedComponents', () => {
    it('should find strongly connected components with cycles', () => {
      const sccs = analyzer.findStronglyConnectedComponents();
      // Should find at least the a-b-c cycle
      expect(sccs.length).toBeGreaterThan(0);
    });
  });

  describe('findReachable', () => {
    it('should find all reachable nodes within depth', () => {
      const reachable = analyzer.findReachable('a', 2);
      expect(reachable.get('a')).toBe(0);
      expect(reachable.get('b')).toBe(1);
      expect(reachable.get('c')).toBe(2);
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', () => {
      const stats = analyzer.getStatistics();

      expect(stats.nodeCount).toBe(4);
      expect(stats.edgeCount).toBe(3);
      expect(stats.hasCycles).toBe(true);
    });
  });
});

describe('Helper Functions', () => {
  describe('createNode', () => {
    it('should create a node with required values', () => {
      const node = createNode({
        id: 'id1',
        type: 'file',
        name: 'test.ts',
        path: '/test.ts',
      });

      expect(node.id).toBe('id1');
      expect(node.type).toBe('file');
      expect(node.name).toBe('test.ts');
      expect(node.path).toBe('/test.ts');
      expect(node.metrics).toBeDefined();
      expect(node.vulnerabilities).toEqual([]);
    });

    it('should allow custom metrics', () => {
      const node = createNode({
        id: 'id1',
        type: 'file',
        name: 'test.ts',
        path: '/test.ts',
        metrics: {
          complexity: 10,
          changeFrequency: 5,
          impactScore: 80,
          testCoverage: 90,
        },
      });

      expect(node.metrics.complexity).toBe(10);
      expect(node.metrics.testCoverage).toBe(90);
    });
  });

  describe('createEdge', () => {
    it('should create an edge with default weight', () => {
      const edge = createEdge({
        source: 'source',
        target: 'target',
        type: 'imports',
      });

      expect(edge.source).toBe('source');
      expect(edge.target).toBe('target');
      expect(edge.type).toBe('imports');
      expect(edge.weight).toBe(1);
    });

    it('should allow custom weight', () => {
      const edge = createEdge({
        source: 'source',
        target: 'target',
        type: 'calls',
        weight: 0.5,
      });
      expect(edge.weight).toBe(0.5);
    });
  });

  describe('calculateImpactSeverity', () => {
    it('should return critical for high score, depth 1, core module', () => {
      expect(calculateImpactSeverity(95, 1, true)).toBe('critical');
      expect(calculateImpactSeverity(100, 1, true)).toBe('critical');
    });

    it('should return high for medium-high scores at shallow depth', () => {
      expect(calculateImpactSeverity(75, 1, false)).toBe('high');
      expect(calculateImpactSeverity(50, 2, false)).toBe('high');
    });

    it('should return medium for medium scores or moderate depth', () => {
      expect(calculateImpactSeverity(30, 2, false)).toBe('medium');
      expect(calculateImpactSeverity(10, 3, false)).toBe('medium');
    });

    it('should return low for low scores', () => {
      expect(calculateImpactSeverity(10, 5, false)).toBe('low');
    });

    it('should return none for zero score at deep depth', () => {
      expect(calculateImpactSeverity(0, 10, false)).toBe('none');
    });
  });

  describe('isCoreModule', () => {
    it('should identify core modules', () => {
      expect(isCoreModule('/src/index.ts')).toBe(true);
      expect(isCoreModule('/src/main.ts')).toBe(true);
      expect(isCoreModule('/src/app.ts')).toBe(true);
      expect(isCoreModule('/src/core/module.ts')).toBe(true);
    });

    it('should identify non-core modules', () => {
      expect(isCoreModule('/src/utils/helper.ts')).toBe(false);
      expect(isCoreModule('/src/components/Button.tsx')).toBe(false);
      expect(isCoreModule('/tests/test.spec.ts')).toBe(false);
    });
  });
});

// ============================================================================
// Layout Algorithm Tests
// ============================================================================

describe('Layout Algorithms', () => {
  let testGraph: Graph;

  beforeEach(() => {
    const builder = new GraphBuilder();

    // Create a simple 4-node graph
    builder.addNode(createNode({ id: 'a', type: 'file', name: 'a.ts', path: '/a.ts' }));
    builder.addNode(createNode({ id: 'b', type: 'file', name: 'b.ts', path: '/b.ts' }));
    builder.addNode(createNode({ id: 'c', type: 'file', name: 'c.ts', path: '/c.ts' }));
    builder.addNode(createNode({ id: 'd', type: 'file', name: 'd.ts', path: '/d.ts' }));

    builder.addEdge(createEdge({ source: 'a', target: 'b', type: 'imports' }));
    builder.addEdge(createEdge({ source: 'a', target: 'c', type: 'imports' }));
    builder.addEdge(createEdge({ source: 'b', target: 'd', type: 'imports' }));

    testGraph = builder.build();
  });

  describe('forceDirectedLayout', () => {
    it('should assign positions to all nodes', () => {
      const positioned = forceDirectedLayout(testGraph);

      positioned.nodes.forEach((node) => {
        expect(node.position).toBeDefined();
        expect(typeof node.position!.x).toBe('number');
        expect(typeof node.position!.y).toBe('number');
      });
    });

    it('should respect width and height options', () => {
      const positioned = forceDirectedLayout(testGraph, { width: 100, height: 100 });

      positioned.nodes.forEach((node) => {
        expect(node.position!.x).toBeGreaterThanOrEqual(0);
        expect(node.position!.x).toBeLessThanOrEqual(100);
        expect(node.position!.y).toBeGreaterThanOrEqual(0);
        expect(node.position!.y).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('hierarchicalLayout', () => {
    it('should assign positions to all nodes', () => {
      const positioned = hierarchicalLayout(testGraph);

      positioned.nodes.forEach((node) => {
        expect(node.position).toBeDefined();
      });
    });
  });

  describe('radialLayout', () => {
    it('should assign positions to all nodes', () => {
      const positioned = radialLayout(testGraph);

      positioned.nodes.forEach((node) => {
        expect(node.position).toBeDefined();
      });
    });
  });

  describe('organicLayout', () => {
    it('should assign positions to all nodes', () => {
      const positioned = organicLayout(testGraph);

      positioned.nodes.forEach((node) => {
        expect(node.position).toBeDefined();
      });
    });
  });

  describe('applyLayout', () => {
    it('should apply force layout when specified', () => {
      const positioned = applyLayout(testGraph, 'force');
      expect(positioned.nodes.every((n) => n.position)).toBe(true);
    });

    it('should apply hierarchical layout when specified', () => {
      const positioned = applyLayout(testGraph, 'hierarchical');
      expect(positioned.nodes.every((n) => n.position)).toBe(true);
    });

    it('should apply radial layout when specified', () => {
      const positioned = applyLayout(testGraph, 'radial');
      expect(positioned.nodes.every((n) => n.position)).toBe(true);
    });

    it('should apply organic layout when specified', () => {
      const positioned = applyLayout(testGraph, 'organic');
      expect(positioned.nodes.every((n) => n.position)).toBe(true);
    });

    it('should default to force layout for unknown type', () => {
      const positioned = applyLayout(testGraph, 'unknown' as LayoutType);
      expect(positioned.nodes.every((n) => n.position)).toBe(true);
    });
  });
});

// ============================================================================
// Empty Graph Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  describe('Empty Graph', () => {
    it('should handle empty graph in layouts', () => {
      const emptyGraph: Graph = {
        nodes: [],
        edges: [],
        metadata: { totalNodes: 0, totalEdges: 0, maxDepth: 0, generatedAt: new Date() },
      };

      expect(() => forceDirectedLayout(emptyGraph)).not.toThrow();
      expect(() => hierarchicalLayout(emptyGraph)).not.toThrow();
      expect(() => radialLayout(emptyGraph)).not.toThrow();
      expect(() => organicLayout(emptyGraph)).not.toThrow();
    });

    it('should handle empty graph in analyzer', () => {
      const emptyGraph: Graph = {
        nodes: [],
        edges: [],
        metadata: { totalNodes: 0, totalEdges: 0, maxDepth: 0, generatedAt: new Date() },
      };

      const analyzer = new GraphAnalyzer(emptyGraph);

      expect(analyzer.findCircularDependencies()).toEqual([]);
      expect(analyzer.calculateImportanceScores().size).toBe(0);
      expect(analyzer.findStronglyConnectedComponents()).toEqual([]);
    });
  });

  describe('Single Node Graph', () => {
    it('should handle single node graph', () => {
      const builder = new GraphBuilder();
      builder.addNode(createNode({ id: 'single', type: 'file', name: 'single.ts', path: '/single.ts' }));
      const graph = builder.build();

      const positioned = forceDirectedLayout(graph);
      expect(positioned.nodes).toHaveLength(1);
      expect(positioned.nodes[0].position).toBeDefined();
    });
  });

  describe('Large Graph Performance', () => {
    it('should handle 100 nodes efficiently', () => {
      const builder = new GraphBuilder();

      // Create 100 nodes
      for (let i = 0; i < 100; i++) {
        builder.addNode(
          createNode({
            id: `node${i}`,
            type: 'file',
            name: `file${i}.ts`,
            path: `/file${i}.ts`,
          })
        );
      }

      // Create edges (each node connects to next 3 nodes)
      for (let i = 0; i < 100; i++) {
        for (let j = 1; j <= 3; j++) {
          builder.addEdge(
            createEdge({
              source: `node${i}`,
              target: `node${(i + j) % 100}`,
              type: 'imports',
            })
          );
        }
      }

      const graph = builder.build();
      expect(graph.nodes).toHaveLength(100);

      // Layout should complete in reasonable time
      const start = Date.now();
      const positioned = forceDirectedLayout(graph, { iterations: 50 });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(positioned.nodes.every((n) => n.position)).toBe(true);
    });
  });
});
