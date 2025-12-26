import { z } from 'zod';

// Request/Response pattern with correlation IDs
export interface Request {
  id: string;          // Correlation ID
  command: string;     // Command name
  params?: any;        // Command-specific parameters
}

export interface Response {
  id: string;          // Matches request ID
  success: boolean;
  data?: any;          // Response payload
  error?: string;      // Error message if failed
}

// Zod schemas for runtime validation
export const RequestSchema = z.object({
  id: z.string(),
  command: z.string(),
  params: z.any().optional(),
});

export const ResponseSchema = z.object({
  id: z.string(),
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
});

// Command-specific parameter schemas
export const DependencyGraphParamsSchema = z.object({
  filePath: z.string(),
  layoutAlgorithm: z.enum(['force', 'hierarchical', 'radial', 'organic']).optional(),
  maxDepth: z.number().optional(),
});

export const EvolutionTimelineParamsSchema = z.object({
  filePath: z.string(),
  maxCommits: z.number().optional(),
});

export const ImpactRippleParamsSchema = z.object({
  filePath: z.string(),
  maxDepth: z.number().optional(),
});

export const SemanticClustersParamsSchema = z.object({
  repositoryPath: z.string(),
});

export const ArchitectureAnalyzeParamsSchema = z.object({
  repositoryPath: z.string(),
});

export const NLQueryParamsSchema = z.object({
  query: z.string(),
  repositoryPath: z.string(),
});

export const ExplainCodeParamsSchema = z.object({
  code: z.string(),
  language: z.string().optional(),
});

export const ImpactAnalysisParamsSchema = z.object({
  filePath: z.string(),
});

export const FileHistoryParamsSchema = z.object({
  filePath: z.string(),
  maxCommits: z.number().optional(),
});

export const SecurityScanParamsSchema = z.object({
  repositoryPath: z.string(),
});

export const GenerateTestsParamsSchema = z.object({
  code: z.string(),
  framework: z.string().optional(),
});

export const GetApiStatusParamsSchema = z.object({});

export const GetRecentMemoriesParamsSchema = z.object({
  limit: z.number().optional(),
});

export const GetRepoStatsParamsSchema = z.object({
  repositoryPath: z.string(),
});

// Command types
export type CommandType =
  | 'getDependencyGraph'
  | 'getEvolutionTimeline'
  | 'getImpactRipple'
  | 'getSemanticClusters'
  | 'analyzeArchitecture'
  | 'nlQuery'
  | 'explainCode'
  | 'impactAnalysis'
  | 'fileHistory'
  | 'securityScan'
  | 'generateTests'
  | 'getApiStatus'
  | 'getRecentMemories'
  | 'getRepoStats';

// Map commands to their parameter schemas
export const CommandSchemas: Record<CommandType, z.ZodSchema> = {
  getDependencyGraph: DependencyGraphParamsSchema,
  getEvolutionTimeline: EvolutionTimelineParamsSchema,
  getImpactRipple: ImpactRippleParamsSchema,
  getSemanticClusters: SemanticClustersParamsSchema,
  analyzeArchitecture: ArchitectureAnalyzeParamsSchema,
  nlQuery: NLQueryParamsSchema,
  explainCode: ExplainCodeParamsSchema,
  impactAnalysis: ImpactAnalysisParamsSchema,
  fileHistory: FileHistoryParamsSchema,
  securityScan: SecurityScanParamsSchema,
  generateTests: GenerateTestsParamsSchema,
  getApiStatus: GetApiStatusParamsSchema,
  getRecentMemories: GetRecentMemoriesParamsSchema,
  getRepoStats: GetRepoStatsParamsSchema,
};
