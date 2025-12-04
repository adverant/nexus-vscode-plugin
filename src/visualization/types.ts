// src/visualization/types.ts
/**
 * NexusMind Visualization Types
 *
 * Core type definitions for the GraphRAG-powered code visualization system.
 */

// ============================================================================
// Graph Node Types
// ============================================================================

export type NodeType = 'file' | 'function' | 'class' | 'method' | 'module' | 'variable' | 'interface';

export type EdgeType = 'imports' | 'calls' | 'extends' | 'implements' | 'contains' | 'references';

export type LayoutType = 'force' | 'hierarchical' | 'radial' | 'organic';

export type ImpactSeverity = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface Position {
  x: number;
  y: number;
}

export interface VulnerabilityInfo {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  cwe?: string;
  affectedVersions?: string;
}

export interface NodeMetrics {
  complexity: number;
  changeFrequency: number;
  impactScore: number;
  testCoverage?: number;
  linesOfCode?: number;
  cyclomaticComplexity?: number;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  path: string;
  metrics: NodeMetrics;
  vulnerabilities: VulnerabilityInfo[];
  position?: Position;
  // Visual properties
  color?: string;
  size?: number;
  opacity?: number;
  // Metadata
  startLine?: number;
  endLine?: number;
  language?: string;
  parentId?: string;
  children?: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
  metadata?: {
    lineNumber?: number;
    isCircular?: boolean;
    count?: number;
  };
  // Visual properties
  color?: string;
  width?: number;
  opacity?: number;
  animated?: boolean;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    rootFile?: string;
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    generatedAt: Date;
  };
}

// ============================================================================
// Dependency Graph Options
// ============================================================================

export interface DependencyGraphFilters {
  nodeTypes: NodeType[];
  edgeTypes: EdgeType[];
  impactThreshold?: number;
  vulnerabilityFilter?: 'all' | 'affected' | 'clean';
  excludePatterns?: string[];
  includePatterns?: string[];
}

export interface DependencyGraphOptions {
  rootFile: string;
  depth: number;
  includeExternal: boolean;
  layout: LayoutType;
  filters: DependencyGraphFilters;
}

// ============================================================================
// Evolution Timeline Types
// ============================================================================

export type ChangeType = 'created' | 'modified' | 'renamed' | 'deleted' | 'refactored';

export type TimelineGranularity = 'commit' | 'day' | 'week' | 'month';

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  commitHash: string;
  author: string;
  authorEmail?: string;
  changeType: ChangeType;
  linesAdded: number;
  linesRemoved: number;
  impactScore: number;
  relatedEntities: string[];
  message: string;
  aiSummary?: string;
}

export interface EvolutionTimelineOptions {
  entity: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  granularity: TimelineGranularity;
  showAuthors: boolean;
  highlightBreakingChanges: boolean;
}

export interface EvolutionTimeline {
  entity: string;
  entityType: NodeType;
  events: TimelineEvent[];
  statistics: {
    totalCommits: number;
    totalAuthors: number;
    totalLinesAdded: number;
    totalLinesRemoved: number;
    averageChangeSize: number;
    mostActiveAuthor: string;
    mostActiveDay: string;
  };
  insights: string[];
}

// ============================================================================
// Impact Ripple Types
// ============================================================================

export interface RippleNode {
  id: string;
  name: string;
  filePath: string;
  depth: number;
  severity: ImpactSeverity;
  impactScore: number;
  usageCount: number;
  usageTypes: EdgeType[];
  position?: Position;
  angle?: number;
  radius?: number;
}

export interface RippleLayer {
  depth: number;
  severity: ImpactSeverity;
  nodes: RippleNode[];
  totalImpact: number;
}

export interface ImpactRippleOptions {
  entityId: string;
  maxDepth: number;
  includeTests: boolean;
  minimumImpactScore: number;
}

export interface ImpactRipple {
  sourceEntity: {
    id: string;
    name: string;
    filePath: string;
    type: NodeType;
  };
  layers: RippleLayer[];
  totalAffected: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  animationData?: {
    pulseSpeed: number;
    colors: Record<ImpactSeverity, string>;
  };
}

// ============================================================================
// Semantic Clustering Types
// ============================================================================

export type ClusteringAlgorithm = 'kmeans' | 'dbscan' | 'hierarchical';

export interface SemanticCluster {
  id: string;
  label: string;
  description: string;
  members: string[];
  centroid: number[];
  cohesion: number;
  keywords: string[];
  dominantType: NodeType;
  color?: string;
  position?: Position;
}

export interface ClusteringOptions {
  algorithm: ClusteringAlgorithm;
  numClusters?: number;
  minClusterSize?: number;
  epsilon?: number;
  useGraphRAGEmbeddings: boolean;
  excludeTests: boolean;
}

export interface ClusteringResult {
  clusters: SemanticCluster[];
  unclustered: string[];
  silhouetteScore: number;
  metadata: {
    algorithm: ClusteringAlgorithm;
    totalEntities: number;
    totalClusters: number;
    avgClusterSize: number;
    generatedAt: Date;
  };
}

// ============================================================================
// Architecture Analysis Types
// ============================================================================

export type ArchitectureIssueType =
  | 'circular-dependency'
  | 'god-class'
  | 'feature-envy'
  | 'inappropriate-intimacy'
  | 'dead-code'
  | 'missing-abstraction'
  | 'tight-coupling'
  | 'shotgun-surgery'
  | 'divergent-change';

export type IssueSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ArchitectureSuggestion {
  id: string;
  type: ArchitectureIssueType;
  severity: IssueSeverity;
  entities: string[];
  description: string;
  suggestedRefactoring: string;
  estimatedImpact: {
    filesAffected: number;
    testCoverage: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
  confidence: number;
  references?: string[];
}

export interface ArchitectureAnalysisOptions {
  scope: 'all' | 'file' | 'directory';
  targetPath?: string;
  issueTypes?: ArchitectureIssueType[];
  minConfidence?: number;
  includeRefactoringSuggestions: boolean;
}

export interface ArchitectureAnalysisResult {
  suggestions: ArchitectureSuggestion[];
  healthScore: number;
  statistics: {
    totalIssues: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
  summary: string;
}

// ============================================================================
// Natural Language Query Types
// ============================================================================

export type GraphOperation =
  | 'highlight'
  | 'filter'
  | 'expand'
  | 'collapse'
  | 'focus'
  | 'compare'
  | 'animate';

export interface NLQueryResult {
  operation: GraphOperation;
  targets: string[];
  filters?: DependencyGraphFilters;
  visualization?: {
    layout?: LayoutType;
    colorScheme?: string;
    highlightColor?: string;
    animationType?: string;
  };
  data: Graph | EvolutionTimeline | ImpactRipple | ClusteringResult;
  explanation: string;
  suggestedFollowUps: string[];
}

export interface NLQueryOptions {
  query: string;
  context?: {
    currentView?: string;
    selectedNodes?: string[];
    currentFilters?: DependencyGraphFilters;
  };
}

// ============================================================================
// PR Overlay Types
// ============================================================================

export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  previousPath?: string;
}

export interface PRReviewer {
  login: string;
  avatarUrl?: string;
  expertise: string[];
  ownershipScore: number;
}

export interface PROverlay {
  prNumber: number;
  title: string;
  changedFiles: ChangedFile[];
  impactAnalysis: ImpactRipple;
  suggestedReviewers: PRReviewer[];
  riskScore: number;
  reviewPath: string[];
  summary: string;
}

// ============================================================================
// Visualization State Types
// ============================================================================

export interface ViewportState {
  zoom: number;
  pan: Position;
  rotation?: number;
}

export interface SelectionState {
  selectedNodes: string[];
  selectedEdges: string[];
  hoveredNode?: string;
  hoveredEdge?: string;
}

export interface VisualizationState {
  graph: Graph;
  viewport: ViewportState;
  selection: SelectionState;
  activeOverlay?: 'impact' | 'evolution' | 'clusters' | 'pr';
  filters: DependencyGraphFilters;
  layout: LayoutType;
}

// ============================================================================
// MCP Tool Response Types
// ============================================================================

export interface VisualizationToolResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: {
    executionTime: number;
    dataSource: string;
    cacheHit?: boolean;
  };
}
