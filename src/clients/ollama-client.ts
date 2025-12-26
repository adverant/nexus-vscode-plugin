/**
 * Ollama API Client for Qwen2.5 72B Integration
 */

import axios, { AxiosInstance } from 'axios';

export interface OllamaConfig {
  endpoint: string;
  model: string;
}

export interface GenerateRequest {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaClient {
  private client: AxiosInstance;
  private config: OllamaConfig;

  constructor(config: OllamaConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.endpoint,
      timeout: 120000, // 2 minutes for LLM inference
    });
  }

  async generate(request: GenerateRequest): Promise<string> {
    try {
      const response = await this.client.post('/api/generate', {
        model: this.config.model,
        prompt: request.prompt,
        system: request.system,
        temperature: request.temperature || 0.7,
        stream: false,
        options: {
          num_predict: request.maxTokens || 1000,
        },
      });

      return response.data.response;
    } catch (error: any) {
      console.error('Ollama generation failed:', error.message);
      throw new Error(`Qwen2.5 72B inference failed: ${error.message}`);
    }
  }

  async enhanceQuery(query: string): Promise<string> {
    const prompt = `Rewrite the following query to be more specific and optimized for code search:

Original query: "${query}"

Enhanced query (respond with only the rewritten query, no explanation):`;

    return await this.generate({
      prompt,
      system: 'You are a query enhancement expert. Rewrite queries to be more specific for code search.',
      temperature: 0.3,
      maxTokens: 200,
    });
  }

  async generateHyDE(query: string): Promise<string> {
    const prompt = `Generate a hypothetical code example or documentation that would answer this query:

Query: "${query}"

Hypothetical answer (provide a realistic code example or explanation):`;

    return await this.generate({
      prompt,
      system: 'You are a code expert. Generate realistic code examples that would answer queries.',
      temperature: 0.5,
      maxTokens: 500,
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/tags');
      const models = response.data.models || [];
      return models.some((m: any) => m.name.includes('qwen'));
    } catch {
      return false;
    }
  }
}
