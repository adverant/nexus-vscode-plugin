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

export const StoreMemoryParamsSchema = z.object({
  content: z.string(),
  tags: z.array(z.string()).optional(),
  domain: z.string().optional(),
  entityType: z.string().optional(),
});

// Memory Tab Command Schemas
export const UploadDocumentParamsSchema = z.object({
  filename: z.string(),
  content: z.string(), // base64 encoded
  mimeType: z.string(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  collectionName: z.string().optional(), // Group files together (dataset, scan batch, etc.)
  sequenceNumber: z.number().optional(), // Order within collection
});

export const SearchMemoriesParamsSchema = z.object({
  query: z.string(),
  filters: z.object({
    domain: z.string().optional(),
    type: z.string().optional(),
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
    tags: z.array(z.string()).optional(),
    projectName: z.string().optional(),
  }).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

export const GetEpisodicDataParamsSchema = z.object({
  entityId: z.string().optional(),
  timeRange: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
  }).optional(),
  limit: z.number().optional(),
});

export const ListSkillsParamsSchema = z.object({});

export const ManageSkillParamsSchema = z.object({
  action: z.enum(['add', 'remove', 'view', 'update']),
  skillName: z.string(),
  content: z.string().optional(),
});

export const ListHooksParamsSchema = z.object({});

export const GetJobStatusParamsSchema = z.object({
  jobId: z.string(),
});

// Subscription/Plugin Access Schemas
export const CheckPluginAccessParamsSchema = z.object({
  pluginName: z.string(),
  action: z.string().optional(),
});

export const GetUserSubscriptionParamsSchema = z.object({});

export const GetMarketplacePluginsParamsSchema = z.object({
  category: z.string().optional(),
});

// Settings Tab - User & API Key Schemas
export const GetCurrentUserParamsSchema = z.object({});

export const GetApiKeysParamsSchema = z.object({});

export const CreateApiKeyParamsSchema = z.object({
  name: z.string(),
  expiresInDays: z.number().optional(),
});

export const RevokeApiKeyParamsSchema = z.object({
  keyId: z.string(),
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
  | 'getRepoStats'
  | 'storeMemory'
  // Memory Tab Commands
  | 'uploadDocument'
  | 'searchMemories'
  | 'getEpisodicData'
  | 'listSkills'
  | 'manageSkill'
  | 'listHooks'
  | 'getJobStatus'
  // Subscription Commands
  | 'checkPluginAccess'
  | 'getUserSubscription'
  | 'getMarketplacePlugins'
  // Settings Tab Commands
  | 'getCurrentUser'
  | 'getApiKeys'
  | 'createApiKey'
  | 'revokeApiKey';

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
  storeMemory: StoreMemoryParamsSchema,
  // Memory Tab Commands
  uploadDocument: UploadDocumentParamsSchema,
  searchMemories: SearchMemoriesParamsSchema,
  getEpisodicData: GetEpisodicDataParamsSchema,
  listSkills: ListSkillsParamsSchema,
  manageSkill: ManageSkillParamsSchema,
  listHooks: ListHooksParamsSchema,
  getJobStatus: GetJobStatusParamsSchema,
  // Subscription Commands
  checkPluginAccess: CheckPluginAccessParamsSchema,
  getUserSubscription: GetUserSubscriptionParamsSchema,
  getMarketplacePlugins: GetMarketplacePluginsParamsSchema,
  // Settings Tab Commands
  getCurrentUser: GetCurrentUserParamsSchema,
  getApiKeys: GetApiKeysParamsSchema,
  createApiKey: CreateApiKeyParamsSchema,
  revokeApiKey: RevokeApiKeyParamsSchema,
};
