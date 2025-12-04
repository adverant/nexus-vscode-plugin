// src/visualization/layout-algorithms.ts
/**
 * NexusMind Layout Algorithms
 *
 * Graph layout algorithms for visualizing code dependencies.
 * Supports force-directed, hierarchical, radial, and organic layouts.
 */

import { Graph, GraphNode, GraphEdge, Position, LayoutType } from './types.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============================================================================
// Layout Options
// ============================================================================

export interface LayoutOptions {
  width: number;
  height: number;
  padding: number;
  nodeSpacing: number;
  layerSpacing: number;
  iterations?: number;
  centerX?: number;
  centerY?: number;
}

const DEFAULT_OPTIONS: LayoutOptions = {
  width: 1200,
  height: 800,
  padding: 50,
  nodeSpacing: 100,
  layerSpacing: 150,
  iterations: 300,
};

// ============================================================================
// Force-Directed Layout
// ============================================================================

interface ForceNode extends GraphNode {
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
}

export function forceDirectedLayout(graph: Graph, options: Partial<LayoutOptions> = {}): Graph {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const centerX = opts.centerX ?? opts.width / 2;
  const centerY = opts.centerY ?? opts.height / 2;

  // Initialize nodes with random positions and velocities
  const nodes: ForceNode[] = graph.nodes.map((node) => ({
    ...node,
    position: node.position || {
      x: centerX + (Math.random() - 0.5) * opts.width * 0.5,
      y: centerY + (Math.random() - 0.5) * opts.height * 0.5,
    },
    vx: 0,
    vy: 0,
  }));

  const nodeMap = new Map<string, ForceNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  // Build edge lookup for connected nodes
  const connectedPairs = new Set<string>();
  for (const edge of graph.edges) {
    connectedPairs.add(`${edge.source}-${edge.target}`);
    connectedPairs.add(`${edge.target}-${edge.source}`);
  }

  // Simulation parameters
  const repulsionStrength = 5000;
  const attractionStrength = 0.1;
  const dampingFactor = 0.9;
  const minDistance = opts.nodeSpacing;

  // Run simulation
  for (let iteration = 0; iteration < opts.iterations!; iteration++) {
    const alpha = 1 - iteration / opts.iterations!;

    // Calculate repulsion forces (all pairs)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        const dx = nodeB.position!.x - nodeA.position!.x;
        const dy = nodeB.position!.y - nodeA.position!.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        // Repulsion force (inverse square law)
        const force = (repulsionStrength * alpha) / (distance * distance);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        nodeA.vx -= fx;
        nodeA.vy -= fy;
        nodeB.vx += fx;
        nodeB.vy += fy;
      }
    }

    // Calculate attraction forces (connected pairs)
    for (const edge of graph.edges) {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      if (!sourceNode || !targetNode) continue;

      const dx = targetNode.position!.x - sourceNode.position!.x;
      const dy = targetNode.position!.y - sourceNode.position!.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;

      // Attraction force (spring)
      const idealLength = minDistance * (1 + 1 / (edge.weight || 1));
      const displacement = distance - idealLength;
      const force = attractionStrength * displacement * alpha;

      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      sourceNode.vx += fx;
      sourceNode.vy += fy;
      targetNode.vx -= fx;
      targetNode.vy -= fy;
    }

    // Center gravity
    for (const node of nodes) {
      const dx = centerX - node.position!.x;
      const dy = centerY - node.position!.y;
      node.vx += dx * 0.01 * alpha;
      node.vy += dy * 0.01 * alpha;
    }

    // Apply velocities with damping
    for (const node of nodes) {
      if (node.fx !== undefined) {
        node.position!.x = node.fx;
        node.vx = 0;
      } else {
        node.vx *= dampingFactor;
        node.position!.x += node.vx;
      }

      if (node.fy !== undefined) {
        node.position!.y = node.fy;
        node.vy = 0;
      } else {
        node.vy *= dampingFactor;
        node.position!.y += node.vy;
      }

      // Boundary constraints
      node.position!.x = Math.max(opts.padding, Math.min(opts.width - opts.padding, node.position!.x));
      node.position!.y = Math.max(opts.padding, Math.min(opts.height - opts.padding, node.position!.y));
    }
  }

  // Return updated graph
  return {
    ...graph,
    nodes: nodes.map(({ vx, vy, fx, fy, ...node }) => node),
  };
}

// ============================================================================
// Hierarchical Layout (Sugiyama-style)
// ============================================================================

export function hierarchicalLayout(graph: Graph, options: Partial<LayoutOptions> = {}): Graph {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Step 1: Assign layers using longest path
  const layers = assignLayers(graph);

  // Step 2: Order nodes within layers to minimize crossings
  const orderedLayers = orderLayers(layers, graph);

  // Step 3: Assign positions
  const nodes = assignHierarchicalPositions(orderedLayers, graph.nodes, opts);

  return {
    ...graph,
    nodes,
  };
}

function assignLayers(graph: Graph): Map<string, number> {
  const layers = new Map<string, number>();
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();

  // Initialize
  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    adjacencyList.set(node.id, []);
  }

  // Build adjacency and in-degree
  for (const edge of graph.edges) {
    adjacencyList.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Topological sort with layer assignment
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
      layers.set(nodeId, 0);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers.get(current)!;

    for (const neighbor of adjacencyList.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);

      // Update layer to be max of all incoming
      const existingLayer = layers.get(neighbor) || 0;
      layers.set(neighbor, Math.max(existingLayer, currentLayer + 1));

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Handle cycles: assign remaining nodes to layer 0
  for (const node of graph.nodes) {
    if (!layers.has(node.id)) {
      layers.set(node.id, 0);
    }
  }

  return layers;
}

function orderLayers(layers: Map<string, number>, graph: Graph): Map<number, string[]> {
  const orderedLayers = new Map<number, string[]>();

  // Group nodes by layer
  for (const [nodeId, layer] of layers) {
    if (!orderedLayers.has(layer)) {
      orderedLayers.set(layer, []);
    }
    orderedLayers.get(layer)!.push(nodeId);
  }

  // Build adjacency for ordering
  const adjacencyList = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adjacencyList.set(node.id, []);
  }
  for (const edge of graph.edges) {
    adjacencyList.get(edge.source)?.push(edge.target);
  }

  // Order layers using barycenter method
  const maxLayer = Math.max(...orderedLayers.keys());

  for (let iteration = 0; iteration < 4; iteration++) {
    // Forward pass
    for (let layer = 1; layer <= maxLayer; layer++) {
      const nodesInLayer = orderedLayers.get(layer) || [];
      const prevLayer = orderedLayers.get(layer - 1) || [];
      const prevPositions = new Map<string, number>();
      prevLayer.forEach((id, idx) => prevPositions.set(id, idx));

      // Calculate barycenter for each node
      const barycenters = nodesInLayer.map((nodeId) => {
        const neighbors = adjacencyList.get(nodeId) || [];
        const positions = neighbors
          .filter((n) => prevPositions.has(n))
          .map((n) => prevPositions.get(n)!);

        const barycenter =
          positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : 0;

        return { nodeId, barycenter };
      });

      // Sort by barycenter
      barycenters.sort((a, b) => a.barycenter - b.barycenter);
      orderedLayers.set(
        layer,
        barycenters.map((b) => b.nodeId)
      );
    }
  }

  return orderedLayers;
}

function assignHierarchicalPositions(
  orderedLayers: Map<number, string[]>,
  originalNodes: GraphNode[],
  opts: LayoutOptions
): GraphNode[] {
  const nodeMap = new Map<string, GraphNode>();
  originalNodes.forEach((n) => nodeMap.set(n.id, { ...n }));

  const maxLayer = Math.max(...orderedLayers.keys());
  const layerHeight = (opts.height - 2 * opts.padding) / Math.max(maxLayer, 1);

  for (const [layer, nodeIds] of orderedLayers) {
    const y = opts.padding + layer * layerHeight;
    const layerWidth = opts.width - 2 * opts.padding;
    const nodeSpacing = layerWidth / Math.max(nodeIds.length, 1);

    nodeIds.forEach((nodeId, index) => {
      const node = nodeMap.get(nodeId);
      if (node) {
        node.position = {
          x: opts.padding + (index + 0.5) * nodeSpacing,
          y,
        };
      }
    });
  }

  return Array.from(nodeMap.values());
}

// ============================================================================
// Radial Layout
// ============================================================================

export function radialLayout(
  graph: Graph,
  rootId?: string,
  options: Partial<LayoutOptions> = {}
): Graph {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const centerX = opts.centerX ?? opts.width / 2;
  const centerY = opts.centerY ?? opts.height / 2;
  const maxRadius = Math.min(opts.width, opts.height) / 2 - opts.padding;

  // Find root (use provided or find node with no incoming edges)
  const inDegree = new Map<string, number>();
  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
  }
  for (const edge of graph.edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  let root = rootId;
  if (!root) {
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        root = nodeId;
        break;
      }
    }
  }
  if (!root && graph.nodes.length > 0) {
    root = graph.nodes[0].id;
  }

  if (!root) {
    return graph; // Empty graph
  }

  // BFS to assign levels
  const levels = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();

  for (const node of graph.nodes) {
    adjacencyList.set(node.id, []);
  }
  for (const edge of graph.edges) {
    adjacencyList.get(edge.source)?.push(edge.target);
  }

  const queue: Array<{ id: string; level: number }> = [{ id: root, level: 0 }];
  levels.set(root, 0);

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;

    for (const neighbor of adjacencyList.get(id) || []) {
      if (!levels.has(neighbor)) {
        levels.set(neighbor, level + 1);
        queue.push({ id: neighbor, level: level + 1 });
      }
    }
  }

  // Handle disconnected nodes
  for (const node of graph.nodes) {
    if (!levels.has(node.id)) {
      levels.set(node.id, 0);
    }
  }

  // Group by level
  const levelGroups = new Map<number, string[]>();
  for (const [nodeId, level] of levels) {
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)!.push(nodeId);
  }

  const maxLevel = Math.max(...levelGroups.keys(), 0);
  const radiusStep = maxRadius / Math.max(maxLevel, 1);

  // Assign positions
  const nodeMap = new Map<string, GraphNode>();
  graph.nodes.forEach((n) => nodeMap.set(n.id, { ...n }));

  for (const [level, nodeIds] of levelGroups) {
    if (level === 0) {
      // Root at center
      for (const nodeId of nodeIds) {
        const node = nodeMap.get(nodeId);
        if (node) {
          node.position = { x: centerX, y: centerY };
        }
      }
    } else {
      const radius = level * radiusStep;
      const angleStep = (2 * Math.PI) / nodeIds.length;

      nodeIds.forEach((nodeId, index) => {
        const angle = index * angleStep - Math.PI / 2; // Start from top
        const node = nodeMap.get(nodeId);
        if (node) {
          node.position = {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle),
          };
        }
      });
    }
  }

  return {
    ...graph,
    nodes: Array.from(nodeMap.values()),
  };
}

// ============================================================================
// Organic Layout (Fruchterman-Reingold variant)
// ============================================================================

export function organicLayout(graph: Graph, options: Partial<LayoutOptions> = {}): Graph {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Similar to force-directed but with different parameters for organic feel
  const area = opts.width * opts.height;
  const k = Math.sqrt(area / graph.nodes.length);
  const temperature = opts.width / 10;

  const nodes = graph.nodes.map((node) => ({
    ...node,
    position: node.position || {
      x: opts.padding + Math.random() * (opts.width - 2 * opts.padding),
      y: opts.padding + Math.random() * (opts.height - 2 * opts.padding),
    },
    displacement: { x: 0, y: 0 },
  }));

  const nodeMap = new Map<string, (typeof nodes)[0]>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  for (let iteration = 0; iteration < opts.iterations!; iteration++) {
    const currentTemp = temperature * (1 - iteration / opts.iterations!);

    // Reset displacements
    for (const node of nodes) {
      node.displacement = { x: 0, y: 0 };
    }

    // Repulsive forces
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].position!.x - nodes[i].position!.x;
        const dy = nodes[j].position!.y - nodes[i].position!.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;

        const repulsion = (k * k) / distance;
        const fx = (dx / distance) * repulsion;
        const fy = (dy / distance) * repulsion;

        nodes[i].displacement.x -= fx;
        nodes[i].displacement.y -= fy;
        nodes[j].displacement.x += fx;
        nodes[j].displacement.y += fy;
      }
    }

    // Attractive forces
    for (const edge of graph.edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);

      if (!source || !target) continue;

      const dx = target.position!.x - source.position!.x;
      const dy = target.position!.y - source.position!.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;

      const attraction = (distance * distance) / k;
      const fx = (dx / distance) * attraction;
      const fy = (dy / distance) * attraction;

      source.displacement.x += fx;
      source.displacement.y += fy;
      target.displacement.x -= fx;
      target.displacement.y -= fy;
    }

    // Apply displacements with temperature limiting
    for (const node of nodes) {
      const dispLength = Math.sqrt(
        node.displacement.x * node.displacement.x + node.displacement.y * node.displacement.y
      );

      if (dispLength > 0) {
        const limitedDisp = Math.min(dispLength, currentTemp);
        node.position!.x += (node.displacement.x / dispLength) * limitedDisp;
        node.position!.y += (node.displacement.y / dispLength) * limitedDisp;
      }

      // Boundary constraints
      node.position!.x = Math.max(opts.padding, Math.min(opts.width - opts.padding, node.position!.x));
      node.position!.y = Math.max(opts.padding, Math.min(opts.height - opts.padding, node.position!.y));
    }
  }

  return {
    ...graph,
    nodes: nodes.map(({ displacement, ...node }) => node),
  };
}

// ============================================================================
// Layout Dispatcher
// ============================================================================

export function applyLayout(
  graph: Graph,
  layoutType: LayoutType,
  options?: Partial<LayoutOptions>,
  rootId?: string
): Graph {
  logger.debug({ layoutType, nodeCount: graph.nodes.length }, 'Applying layout');

  switch (layoutType) {
    case 'force':
      return forceDirectedLayout(graph, options);
    case 'hierarchical':
      return hierarchicalLayout(graph, options);
    case 'radial':
      return radialLayout(graph, rootId, options);
    case 'organic':
      return organicLayout(graph, options);
    default:
      logger.warn({ layoutType }, 'Unknown layout type, using force-directed');
      return forceDirectedLayout(graph, options);
  }
}
