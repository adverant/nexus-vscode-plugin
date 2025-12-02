// src/types.ts
export interface NexusConfig {
  apiKey: string;
  endpoint: string;
  workspaceRoot: string;
}

export interface AuthContext {
  userId: string;
  email: string;
  tier: string;
  organizationId?: string;
  permissions: string[];
  quotas: {
    requestsPerMinute: number;
    tokensPerMonth: number;
  };
}

export interface IndexedRepository {
  path: string;
  name: string;
  lastIndexed: Date;
  fileCount: number;
  nodeCount: number;
  commitCount: number;
}

export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java';

export interface ParsedFile {
  path: string;
  language: SupportedLanguage;
  nodes: ASTNode[];
  imports: ImportNode[];
  exports: ExportNode[];
}

export interface ASTNode {
  id: string;
  type: 'class' | 'function' | 'method' | 'variable' | 'interface';
  name: string;
  startLine: number;
  endLine: number;
  parentId?: string;
  children: string[];
}

export interface ImportNode {
  source: string;
  specifiers: string[];
  isDefault: boolean;
  line: number;
}

export interface ExportNode {
  name: string;
  isDefault: boolean;
  line: number;
}
