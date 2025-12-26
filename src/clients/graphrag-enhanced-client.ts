/**
 * GraphRAG Enhanced API Client
 */

import axios, { AxiosInstance } from 'axios';
import { GraphRAGConfig } from './graphrag-client';

export interface EnhancedSearchRequest {
  query: string;
  userId: string;
  sessionId: string;
  options?: {
    enableQueryEnhancement?: boolean;
    enableSelfCorrection?: boolean;
    enableRAGTriadEval?: boolean;
    topK?: number;
    returnRawScores?: boolean;
    includeIterationTrace?: boolean;
  };
}

export interface EnhancedSearchResponse {
  success: boolean;
  results: any[];
  enhancement?: {
    originalQuery: string;
    enhancedQuery: string;
    hydeDocument?: string;
    queryVariations?: string[];
    routingDecision?: {
      route: string;
      reason: string;
      confidence: number;
    };
  };
  quality?: {
    contextRelevance: number;
    groundedness: number;
    answerRelevance: number;
    overall: number;
  };
  iterations?: any[];
  metrics?: {
    totalLatencyMs: number;
    queryEnhancementMs: number;
    routingMs: number;
    retrievalMs: number;
    evaluationMs: number;
  };
}

export interface AnalyzeQueryRequest {
  query: string;
}

export interface AnalyzeQueryResponse {
  success: boolean;
  query: string;
  analysis: {
    intent: string;
    complexity: string;
    keywords: string[];
    entities: string[];
  };
  routingDecision: {
    route: string;
    reason: string;
    confidence: number;
    estimatedLatencyMs: number;
  };
}

export class GraphRAGEnhancedClient {
  private client: AxiosInstance;
  private config: GraphRAGConfig;

  constructor(config: GraphRAGConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.apiEndpoint,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'X-Company-ID': config.companyId,
        'X-App-ID': config.appId,
        'X-User-ID': config.userId || 'vscode-user',
        'Content-Type': 'application/json',
      },
      timeout: 60000, // Longer timeout for enhanced operations
    });
  }

  async enhancedSearch(request: EnhancedSearchRequest): Promise<EnhancedSearchResponse> {
    const response = await this.client.post('/enhanced/search', request);
    return response.data;
  }

  async analyzeQuery(request: AnalyzeQueryRequest): Promise<AnalyzeQueryResponse> {
    const response = await this.client.post('/enhanced/analyze', request);
    return response.data;
  }

  async evaluate(query: string, context: string[], answer: string): Promise<any> {
    const response = await this.client.post('/enhanced/evaluate', {
      query,
      context,
      answer,
    });
    return response.data;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}
