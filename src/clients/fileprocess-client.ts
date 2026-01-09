// src/clients/fileprocess-client.ts
import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';

export interface FileUploadRequest {
  filename: string;
  content: string; // base64 encoded
  mimeType: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  collectionName?: string; // Group files together (dataset, scan batch, video series, etc.)
  sequenceNumber?: number; // Order within collection
}

export interface ProcessingJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  filename: string;
  stage?: string;
  message?: string;
  result?: ProcessingResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessingResult {
  documentId: string;
  title: string;
  pageCount?: number;
  wordCount?: number;
  extractedText?: string;
  summary?: string;
  entities?: string[];
  embeddings?: boolean;
  ocrUsed?: boolean;
}

export type ProgressCallback = (job: ProcessingJob) => void;

export class FileProcessClient extends EventEmitter {
  private client: AxiosInstance;
  private wsEndpoint: string;
  private activeWebSocket: WebSocket | null = null;

  constructor(
    apiEndpoint: string,
    wsEndpoint: string,
    apiKey: string,
    companyId?: string,
    appId?: string
  ) {
    super();
    this.wsEndpoint = wsEndpoint;

    this.client = axios.create({
      baseURL: apiEndpoint,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Company-ID': companyId || 'adverant',
        'X-App-ID': appId || 'nexus-vscode',
      },
      timeout: 300000, // 5 min timeout for large files
      maxContentLength: 5 * 1024 * 1024 * 1024, // 5GB
      maxBodyLength: 5 * 1024 * 1024 * 1024,
    });
  }

  async uploadFile(request: FileUploadRequest): Promise<ProcessingJob> {
    const formData = new FormData();

    // Convert base64 to blob
    const binaryString = atob(request.content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: request.mimeType });

    formData.append('file', blob, request.filename);

    if (request.tags) {
      formData.append('tags', JSON.stringify(request.tags));
    }

    if (request.metadata) {
      formData.append('metadata', JSON.stringify(request.metadata));
    }

    if (request.collectionName) {
      formData.append('collectionName', request.collectionName);
    }

    if (request.sequenceNumber !== undefined) {
      formData.append('sequenceNumber', String(request.sequenceNumber));
    }

    const response = await this.client.post('/fileprocess/api/process', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  async uploadFileFromBuffer(
    buffer: Buffer,
    filename: string,
    mimeType: string,
    options?: {
      tags?: string[];
      metadata?: Record<string, unknown>;
      collectionName?: string;
      sequenceNumber?: number;
    }
  ): Promise<ProcessingJob> {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });

    formData.append('file', blob, filename);

    if (options?.tags) {
      formData.append('tags', JSON.stringify(options.tags));
    }

    if (options?.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    if (options?.collectionName) {
      formData.append('collectionName', options.collectionName);
    }

    if (options?.sequenceNumber !== undefined) {
      formData.append('sequenceNumber', String(options.sequenceNumber));
    }

    const response = await this.client.post('/fileprocess/api/process', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  async getJobStatus(jobId: string): Promise<ProcessingJob> {
    const response = await this.client.get(`/fileprocess/api/jobs/${jobId}`);
    return response.data;
  }

  async listJobs(options?: { status?: string; limit?: number; offset?: number }): Promise<ProcessingJob[]> {
    const response = await this.client.get('/fileprocess/api/jobs', {
      params: options,
    });
    return response.data.jobs || [];
  }

  async cancelJob(jobId: string): Promise<boolean> {
    try {
      await this.client.delete(`/fileprocess/api/jobs/${jobId}`);
      return true;
    } catch {
      return false;
    }
  }

  subscribeToProgress(jobId: string, callback: ProgressCallback): () => void {
    // Use WebSocket for real-time progress
    const ws = new WebSocket(`${this.wsEndpoint}?jobId=${jobId}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);

        // Emit event for other listeners
        this.emit('progress', data);

        // Close connection when job completes
        if (data.status === 'completed' || data.status === 'failed') {
          ws.close();
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Fall back to polling
      this.pollJobStatus(jobId, callback);
    };

    ws.onclose = () => {
      this.activeWebSocket = null;
    };

    this.activeWebSocket = ws;

    // Return cleanup function
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }

  private async pollJobStatus(jobId: string, callback: ProgressCallback): Promise<void> {
    const poll = async () => {
      try {
        const job = await this.getJobStatus(jobId);
        callback(job);

        if (job.status !== 'completed' && job.status !== 'failed') {
          setTimeout(poll, 2000); // Poll every 2 seconds
        }
      } catch (e) {
        console.error('Error polling job status:', e);
      }
    };

    poll();
  }

  async getSupportedFormats(): Promise<string[]> {
    try {
      const response = await this.client.get('/fileprocess/api/formats');
      return response.data.formats || [];
    } catch {
      // Return common supported formats as fallback
      return [
        'pdf', 'docx', 'doc', 'txt', 'md', 'rtf',
        'epub', 'mobi',
        'png', 'jpg', 'jpeg', 'gif', 'webp', 'tiff',
        'zip', 'rar', '7z', 'tar', 'gz',
        'json', 'xml', 'csv', 'xlsx', 'xls',
      ];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/fileprocess/api/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }

  disconnect(): void {
    if (this.activeWebSocket) {
      this.activeWebSocket.close();
      this.activeWebSocket = null;
    }
    this.removeAllListeners();
  }
}
