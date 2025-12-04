// src/visualization/index.ts
/**
 * NexusMind Visualization Module
 *
 * Exports all visualization components for the GraphRAG-powered
 * code visualization and mind mapping system.
 */

// Types
export type {
  // Graph types
  NodeType,
  EdgeType,
  LayoutType,
  ImpactSeverity,
  Position,
  VulnerabilityInfo,
  NodeMetrics,
  GraphNode,
  GraphEdge,
  Graph,

  // Dependency graph
  DependencyGraphFilters,
  DependencyGraphOptions,

  // Evolution timeline
  ChangeType,
  TimelineGranularity,
  TimelineEvent,
  EvolutionTimelineOptions,
  EvolutionTimeline,

  // Impact ripple
  RippleNode,
  RippleLayer,
  ImpactRippleOptions,
  ImpactRipple,

  // Semantic clustering
  ClusteringAlgorithm,
  SemanticCluster,
  ClusteringOptions,
  ClusteringResult,

  // Architecture analysis
  ArchitectureIssueType,
  IssueSeverity,
  ArchitectureSuggestion,
  ArchitectureAnalysisOptions,
  ArchitectureAnalysisResult,

  // Natural language query
  GraphOperation,
  NLQueryResult,
  NLQueryOptions,

  // PR overlay
  ChangedFile,
  PRReviewer,
  PROverlay,

  // Visualization state
  ViewportState,
  SelectionState,
  VisualizationState,
  VisualizationToolResponse,
} from './types.js';

// Graph Engine
export {
  GraphBuilder,
  GraphAnalyzer,
  createNode,
  createEdge,
  calculateImpactSeverity,
  isCoreModule,
} from './graph-engine.js';

// Layout Algorithms
export {
  forceDirectedLayout,
  hierarchicalLayout,
  radialLayout,
  organicLayout,
  applyLayout,
  type LayoutOptions,
} from './layout-algorithms.js';

// Dependency Graph Builder
export {
  DependencyGraphBuilder,
  createDefaultFilters,
  createDefaultOptions,
} from './dependency-graph.js';

// Evolution Timeline
export {
  EvolutionTimelineBuilder,
  createDefaultTimelineOptions,
} from './evolution-timeline.js';

// Impact Ripple
export {
  ImpactRippleBuilder,
  createDefaultRippleOptions,
  generateRippleAnimation,
  getSeverityColor,
  getDepthOpacity,
} from './impact-ripple.js';

// Semantic Clustering
export {
  SemanticClusteringEngine,
  createDefaultClusteringOptions,
} from './semantic-clusters.js';

// Architecture Advisor
export {
  ArchitectureAdvisor,
  createDefaultAnalysisOptions,
} from './architecture-advisor.js';

// Natural Language Query
export {
  NLGraphQueryProcessor,
  createNLQueryProcessor,
} from './nl-graph-query.js';
