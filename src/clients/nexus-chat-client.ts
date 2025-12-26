// src/clients/nexus-chat-client.ts
import axios, { AxiosInstance } from 'axios';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ChatMessage {
  message: string;
  sessionId?: string;
  context?: {
    files?: Array<{
      path: string;
      content?: string;
      language?: string;
    }>;
    repository?: {
      path: string;
      branch?: string;
    };
  };
  options?: {
    async?: boolean;
    streaming?: boolean;
    model?: string;
  };
}

export interface ChatResponse {
  messageId: string;
  sessionId: string;
  type: 'text' | 'artifact' | 'error' | 'task_created';
  content: string;
  artifact?: {
    type: string;
    title?: string;
    data: any;
  };
  routing?: {
    service: string;
    operation: string;
    confidence: number;
  };
  task?: {
    taskId: string;
    status: string;
    estimatedDuration?: number;
  };
}

/**
 * Client for Nexus Chat API
 * Routes requests through the unified chat backend which handles:
 * - Intent detection and routing
 * - MageAgent orchestration
 * - GraphRAG queries
 * - Code execution in sandbox
 * - File processing
 */
export class NexusChatClient {
  private client: AxiosInstance;
  private sessionId: string | undefined;

  constructor(endpoint: string, apiKey: string) {
    this.client = axios.create({
      baseURL: endpoint,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000, // 2 minutes for complex requests
    });
  }

  /**
   * Send a chat message to the Nexus backend
   * The backend will automatically route to the appropriate service
   */
  async chat(request: ChatMessage): Promise<ChatResponse> {
    try {
      const response = await this.client.post<ChatResponse>('/api/chat', {
        message: request.message,
        sessionId: request.sessionId || this.sessionId,
        context: request.context,
        options: request.options,
      });

      // Store session ID for continuity
      if (response.data.sessionId) {
        this.sessionId = response.data.sessionId;
      }

      return response.data;
    } catch (error: any) {
      logger.error({ error, message: request.message }, 'Chat request failed');
      throw new Error(error.response?.data?.error?.message || error.message || 'Chat request failed');
    }
  }

  /**
   * Explain code using the chat backend
   */
  async explainCode(code: string, language?: string): Promise<string> {
    const response = await this.chat({
      message: `Explain the following ${language || ''} code in detail:\n\n\`\`\`${language || ''}\n${code}\n\`\`\``,
      options: {
        model: 'claude-3-5-sonnet-20241022', // Use Sonnet for code explanation
      },
    });

    return response.content;
  }

  /**
   * Generate tests using the chat backend
   */
  async generateTests(code: string, framework: string, language?: string): Promise<string> {
    const response = await this.chat({
      message: `Generate comprehensive unit tests for this ${language || ''} code using ${framework}:\n\n\`\`\`${language || ''}\n${code}\n\`\`\``,
      options: {
        model: 'claude-3-5-sonnet-20241022',
      },
    });

    return response.content;
  }

  /**
   * Query the knowledge graph using natural language
   */
  async queryKnowledgeGraph(query: string, repositoryPath?: string): Promise<ChatResponse> {
    return await this.chat({
      message: query,
      context: repositoryPath ? {
        repository: {
          path: repositoryPath,
        },
      } : undefined,
    });
  }

  /**
   * Execute code in sandbox
   */
  async executeCode(code: string, language: string): Promise<ChatResponse> {
    return await this.chat({
      message: `/sandbox ${language}\n\`\`\`${language}\n${code}\n\`\`\``,
    });
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Reset session (start fresh conversation)
   */
  resetSession(): void {
    this.sessionId = undefined;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
