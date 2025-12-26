// src/clients/graphrag-client.ts
import axios, { AxiosInstance } from 'axios';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface StoreEntityRequest {
  domain: string;
  entityType: string;
  textContent: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  parentId?: string;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export class GraphRAGClient {
  private client: AxiosInstance;

  constructor(endpoint: string, apiKey: string, companyId?: string, appId?: string) {
    this.client = axios.create({
      baseURL: endpoint,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Company-ID': companyId || 'adverant',
        'X-App-ID': appId || 'nexus-vscode',
      },
      timeout: 30000,
    });
  }

  async storeEntity(request: StoreEntityRequest): Promise<{ entityId: string }> {
    const response = await this.client.post('/graphrag/api/entities', {
      domain: request.domain,
      entityType: request.entityType,
      textContent: request.textContent,
      tags: request.tags || [],
      metadata: request.metadata || {},
      parentId: request.parentId,
    });
    return { entityId: response.data.entity_id || response.data.entityId };
  }

  async search(query: string, options?: { limit?: number; domain?: string }): Promise<SearchResult[]> {
    const response = await this.client.post('/graphrag/api/search', {
      query,
      limit: options?.limit || 10,
      filters: options?.domain ? { domain: options.domain } : undefined,
    });

    // API returns { documents, memories, entities, episodes } - combine them
    const data = response.data;
    const results: SearchResult[] = [];

    // Add memories
    if (data.memories && Array.isArray(data.memories)) {
      for (const m of data.memories) {
        results.push({
          id: m.id,
          content: m.content,
          score: m.relevance || m.score || 0,
          metadata: { type: 'memory', tags: m.tags || [] },
        });
      }
    }

    // Add documents
    if (data.documents && Array.isArray(data.documents)) {
      for (const d of data.documents) {
        results.push({
          id: d.id,
          content: d.content || d.text || '',
          score: d.relevance || d.score || 0,
          metadata: { type: 'document', ...d.metadata },
        });
      }
    }

    // Add entities
    if (data.entities && Array.isArray(data.entities)) {
      for (const e of data.entities) {
        results.push({
          id: e.id,
          content: e.content || e.text_content || e.name || '',
          score: e.relevance || e.score || 0,
          metadata: { type: 'entity', entityType: e.entity_type, ...e.metadata },
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  async retrieve(query: string, strategy = 'hybrid'): Promise<{ content: string; sources: SearchResult[] }> {
    const response = await this.client.post('/graphrag/api/retrieve', {
      query,
      strategy,
      max_tokens: 4000,
    });
    return response.data;
  }

  async getEntity(entityId: string): Promise<Record<string, unknown> | null> {
    try {
      const response = await this.client.get(`/graphrag/api/entities/${entityId}`);
      return response.data;
    } catch {
      return null;
    }
  }

  async createRelationship(
    sourceId: string,
    targetId: string,
    relationshipType: string,
    weight?: number
  ): Promise<boolean> {
    try {
      await this.client.post('/graphrag/api/relationships', {
        sourceEntityId: sourceId,
        targetEntityId: targetId,
        relationshipType: relationshipType,
        weight: weight || 1.0,
      });
      return true;
    } catch (error) {
      logger.warn({ error, sourceId, targetId, relationshipType }, 'Failed to create relationship');
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
