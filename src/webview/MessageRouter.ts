import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GraphRAGClient } from '../clients/graphrag-client';
import { VisualizationHandler } from '../handlers/visualization-handler';
import { SecurityScanner } from '../tools/security-scanner';
import { GitService } from '../git/git-service';
import { NexusChatClient } from '../clients/nexus-chat-client';
import { SubscriptionClient, PluginAccess, UserSubscription, AccessCheckResult, CurrentUser, ApiKey } from '../clients/subscription-client';
import { FileProcessClient, ProcessingJob } from '../clients/fileprocess-client';
import {
  Request,
  Response,
  RequestSchema,
  CommandSchemas,
  CommandType,
} from './types';
import { z } from 'zod';

export class MessageRouter {
  private subscriptionClient: SubscriptionClient | null = null;
  private fileProcessClient: FileProcessClient | null = null;

  constructor(
    private _context: vscode.ExtensionContext,
    private graphRAGClient: GraphRAGClient,
    private visualizationHandler: VisualizationHandler,
    private chatClient: NexusChatClient
  ) {}

  setSubscriptionClient(client: SubscriptionClient): void {
    this.subscriptionClient = client;
  }

  setFileProcessClient(client: FileProcessClient): void {
    this.fileProcessClient = client;
  }

  async route(message: any): Promise<Response> {
    try {
      // Validate request structure
      const request = RequestSchema.parse(message) as Request;
      const { id, command, params } = request;

      // Validate command exists
      if (!(command in CommandSchemas)) {
        return {
          id,
          success: false,
          error: `Unknown command: ${command}`,
        };
      }

      // Validate command parameters
      const schema = CommandSchemas[command as CommandType];
      const validatedParams = schema.parse(params || {});

      // Route to appropriate handler
      let data: any;

      switch (command as CommandType) {
        case 'getDependencyGraph':
          data = await this.handleDependencyGraph(validatedParams);
          break;

        case 'getEvolutionTimeline':
          data = await this.handleEvolutionTimeline(validatedParams);
          break;

        case 'getImpactRipple':
          data = await this.handleImpactRipple(validatedParams);
          break;

        case 'getSemanticClusters':
          data = await this.handleSemanticClusters(validatedParams);
          break;

        case 'analyzeArchitecture':
          data = await this.handleArchitectureAnalyze(validatedParams);
          break;

        case 'nlQuery':
          data = await this.handleNLQuery(validatedParams);
          break;

        case 'explainCode':
          data = await this.handleExplainCode(validatedParams);
          break;

        case 'impactAnalysis':
          data = await this.handleImpactAnalysis(validatedParams);
          break;

        case 'fileHistory':
          data = await this.handleFileHistory(validatedParams);
          break;

        case 'securityScan':
          data = await this.handleSecurityScan(validatedParams);
          break;

        case 'generateTests':
          data = await this.handleGenerateTests(validatedParams);
          break;

        case 'getApiStatus':
          data = await this.handleGetApiStatus();
          break;

        case 'getRecentMemories':
          data = await this.handleGetRecentMemories(validatedParams);
          break;

        case 'getRepoStats':
          data = await this.handleGetRepoStats(validatedParams);
          break;

        case 'storeMemory':
          data = await this.handleStoreMemory(validatedParams);
          break;

        // Memory Tab Commands
        case 'uploadDocument':
          data = await this.handleUploadDocument(validatedParams);
          break;

        case 'searchMemories':
          data = await this.handleSearchMemories(validatedParams);
          break;

        case 'getEpisodicData':
          data = await this.handleGetEpisodicData(validatedParams);
          break;

        case 'listSkills':
          data = await this.handleListSkills();
          break;

        case 'manageSkill':
          data = await this.handleManageSkill(validatedParams);
          break;

        case 'listHooks':
          data = await this.handleListHooks();
          break;

        case 'getJobStatus':
          data = await this.handleGetJobStatus(validatedParams);
          break;

        // Subscription Commands
        case 'checkPluginAccess':
          data = await this.handleCheckPluginAccess(validatedParams);
          break;

        case 'getUserSubscription':
          data = await this.handleGetUserSubscription();
          break;

        case 'getMarketplacePlugins':
          data = await this.handleGetMarketplacePlugins(validatedParams);
          break;

        // Settings Tab Commands
        case 'getCurrentUser':
          data = await this.handleGetCurrentUser();
          break;

        case 'getApiKeys':
          data = await this.handleGetApiKeys();
          break;

        case 'createApiKey':
          data = await this.handleCreateApiKey(validatedParams);
          break;

        case 'revokeApiKey':
          data = await this.handleRevokeApiKey(validatedParams);
          break;

        default:
          return {
            id,
            success: false,
            error: `Handler not implemented for command: ${command}`,
          };
      }

      return {
        id,
        success: true,
        data,
      };
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return {
          id: (message as any)?.id || 'unknown',
          success: false,
          error: `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
        };
      }

      // Handle other errors
      return {
        id: (message as any)?.id || 'unknown',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // Handler Methods
  // ============================================================================

  /**
   * Resolve a file path relative to the workspace
   * Tries to find the file in workspace subfolders if not found at root
   */
  private resolveFilePath(filePath: string): string {
    if (!filePath) return '';

    // If already absolute, return as-is
    if (filePath.startsWith('/')) {
      console.log('[Nexus] resolveFilePath: absolute path, returning as-is:', filePath);
      return filePath;
    }

    // Try to find the file in workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      console.log('[Nexus] resolveFilePath: no workspace folders, returning:', filePath);
      return filePath;
    }

    const fs = require('fs');
    const path = require('path');
    const rootPath = workspaceFolders[0].uri.fsPath;
    console.log('[Nexus] resolveFilePath: workspace root:', rootPath, 'filePath:', filePath);

    // First, try directly from workspace root
    const directPath = path.join(rootPath, filePath);
    if (fs.existsSync(directPath)) {
      console.log('[Nexus] resolveFilePath: found at direct path:', directPath);
      return directPath;
    }

    // If not found, try to find it in immediate subdirectories
    // This handles the case where workspace is /Users/don/Adverant but file is in nexus-vscode-plugin/src/
    try {
      const entries = fs.readdirSync(rootPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subPath = path.join(rootPath, entry.name, filePath);
          if (fs.existsSync(subPath)) {
            console.log('[Nexus] resolveFilePath: found in subdirectory:', subPath);
            return subPath;
          }
        }
      }
    } catch (err) {
      console.log('[Nexus] resolveFilePath: error searching subdirs:', err);
    }

    // Return original path if nothing found
    console.log('[Nexus] resolveFilePath: not found, returning original:', filePath);
    return filePath;
  }

  private async handleDependencyGraph(params: any) {
    const filePath = this.resolveFilePath(params.filePath);

    const result = await this.visualizationHandler.handleDependencyGraph({
      rootFile: filePath,
      layout: params.layoutAlgorithm || 'force',
      depth: params.maxDepth || 3,
    });

    if (result.content) {
      const content = result.content.find((c) => c.type === 'text');
      if (content && 'text' in content) {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Failed to generate dependency graph');
  }

  private async handleEvolutionTimeline(params: any) {
    const filePath = this.resolveFilePath(params.filePath);

    const result = await this.visualizationHandler.handleEvolutionTimeline({
      entity: filePath,
    });

    if (result.content) {
      const content = result.content.find((c) => c.type === 'text');
      if (content && 'text' in content) {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Failed to generate evolution timeline');
  }

  private async handleImpactRipple(params: any) {
    const filePath = this.resolveFilePath(params.filePath);

    const result = await this.visualizationHandler.handleImpactRipple({
      entityId: filePath,
      maxDepth: params.maxDepth || 3,
    });

    if (result.content) {
      const content = result.content.find((c) => c.type === 'text');
      if (content && 'text' in content) {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Failed to generate impact ripple');
  }

  private async handleSemanticClusters(params: any) {
    const result = await this.visualizationHandler.handleSemanticClusters({
      query: params.repositoryPath || 'all',
    });

    if (result.content) {
      const content = result.content.find((c) => c.type === 'text');
      if (content && 'text' in content) {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Failed to generate semantic clusters');
  }

  private async handleArchitectureAnalyze(params: any) {
    const result = await this.visualizationHandler.handleArchitectureAnalyze({
      targetPath: params.repositoryPath,
    });

    if (result.content) {
      const content = result.content.find((c) => c.type === 'text');
      if (content && 'text' in content) {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Failed to analyze architecture');
  }

  private async handleNLQuery(params: any) {
    const result = await this.visualizationHandler.handleNLQuery({
      query: params.query,
    });

    if (result.content) {
      const content = result.content.find((c) => c.type === 'text');
      if (content && 'text' in content) {
        return JSON.parse(content.text);
      }
    }

    throw new Error('Failed to execute NL query');
  }

  private async handleExplainCode(params: any) {
    // Use Nexus Chat backend for intelligent code explanation
    const explanation = await this.chatClient.explainCode(
      params.code,
      params.language
    );

    return {
      explanation,
      code: params.code,
      language: params.language,
    };
  }

  private async handleImpactAnalysis(params: any) {
    // Reuse impact ripple for impact analysis
    return this.handleImpactRipple({ filePath: params.filePath, maxDepth: 5 });
  }

  private async handleFileHistory(params: any) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }

    const repoPath = workspaceFolders[0].uri.fsPath;
    const gitService = new GitService(repoPath);
    const history = await gitService.getFileHistory(params.filePath, params.maxCommits || 50);

    return {
      filePath: params.filePath,
      commits: history,
    };
  }

  private async handleSecurityScan(params: any) {
    const scanner = new SecurityScanner(params.repositoryPath);
    const result = await scanner.scan();

    return {
      totalVulnerabilities: result.totalVulnerabilities,
      severityCounts: result.severityCounts,
      reports: result.reports,
    };
  }

  private async handleGenerateTests(params: any) {
    // Use Nexus Chat backend for intelligent test generation
    const tests = await this.chatClient.generateTests(
      params.code,
      params.framework || 'Jest',
      params.language
    );

    return {
      tests,
      framework: params.framework || 'Jest',
      code: params.code,
    };
  }

  private async handleGetApiStatus() {
    try {
      // Try health check to see if API is configured
      const isHealthy = await this.graphRAGClient.healthCheck();
      return {
        configured: true,
        status: isHealthy ? 'connected' : 'disconnected',
      };
    } catch (error) {
      return {
        configured: false,
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleGetRecentMemories(params: any) {
    try {
      // Use a general query to fetch recent memories
      const results = await this.graphRAGClient.search('*', {
        limit: params.limit || 5,
        domain: 'code',
      });

      return {
        memories: results.map((r) => ({
          content: r.content,
          score: r.score,
          metadata: r.metadata,
        })),
      };
    } catch (error) {
      // If search fails, return empty array instead of throwing
      return { memories: [] };
    }
  }

  private async handleGetRepoStats(_params: any) {
    try {
      // Query GraphRAG for repository statistics
      await this.graphRAGClient.search('repository statistics', {
        limit: 1,
        domain: 'code',
      });

      // Return basic stats (in real implementation, would query Neo4j directly)
      return {
        filesIndexed: 0, // Placeholder
        entities: 0,
        relationships: 0,
        lastIndexed: new Date().toISOString(),
      };
    } catch (error) {
      return {
        filesIndexed: 0,
        entities: 0,
        relationships: 0,
        lastIndexed: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async handleStoreMemory(params: any) {
    const result = await this.graphRAGClient.storeEntity({
      domain: params.domain || 'code',
      entityType: params.entityType || 'memory',
      textContent: params.content,
      tags: params.tags || [],
    });

    return {
      success: true,
      entityId: result.entityId,
      message: 'Memory stored successfully',
    };
  }

  // ============================================================================
  // Memory Tab Handlers
  // ============================================================================

  private async handleUploadDocument(params: any): Promise<any> {
    if (!this.fileProcessClient) {
      throw new Error('FileProcess client not initialized. Please check plugin subscription.');
    }

    const job = await this.fileProcessClient.uploadFile({
      filename: params.filename,
      content: params.content,
      mimeType: params.mimeType,
      tags: params.tags,
      metadata: params.metadata,
      collectionName: params.collectionName,
      sequenceNumber: params.sequenceNumber,
    });

    return {
      success: true,
      jobId: job.jobId,
      status: job.status,
      message: 'Document upload started',
    };
  }

  private async handleSearchMemories(params: any): Promise<any> {
    const filters = params.filters || {};

    // Build search query with filters
    let searchQuery = params.query;

    // Use GraphRAG search with filters
    const results = await this.graphRAGClient.search(searchQuery, {
      limit: params.limit || 20,
      domain: filters.domain,
    });

    // Filter by tags if specified
    let filteredResults = results;
    if (filters.tags && filters.tags.length > 0) {
      filteredResults = results.filter((r: any) => {
        const resultTags = r.metadata?.tags || [];
        return filters.tags.some((tag: string) => resultTags.includes(tag));
      });
    }

    // Filter by date range if specified
    if (filters.dateRange?.start || filters.dateRange?.end) {
      filteredResults = filteredResults.filter((r: any) => {
        const createdAt = r.metadata?.createdAt || r.metadata?.timestamp;
        if (!createdAt) return true;

        const date = new Date(createdAt);
        if (filters.dateRange.start && date < new Date(filters.dateRange.start)) return false;
        if (filters.dateRange.end && date > new Date(filters.dateRange.end)) return false;
        return true;
      });
    }

    return {
      success: true,
      query: params.query,
      totalResults: filteredResults.length,
      results: filteredResults.map((r: any) => ({
        id: r.id,
        content: r.content,
        score: r.score,
        type: r.metadata?.type || 'memory',
        tags: r.metadata?.tags || [],
        createdAt: r.metadata?.createdAt || r.metadata?.timestamp,
        metadata: r.metadata,
      })),
    };
  }

  private async handleGetEpisodicData(params: any): Promise<any> {
    // Query GraphRAG for episodic data (sessions, conversations, etc.)
    const query = params.entityId
      ? `episodic data for ${params.entityId}`
      : 'recent episodic sessions';

    const results = await this.graphRAGClient.search(query, {
      limit: params.limit || 50,
      domain: 'claude-code',
    });

    // Filter by time range if specified
    let episodes = results;
    if (params.timeRange?.start || params.timeRange?.end) {
      episodes = results.filter((r: any) => {
        const timestamp = r.metadata?.timestamp || r.metadata?.createdAt;
        if (!timestamp) return true;

        const date = new Date(timestamp);
        if (params.timeRange.start && date < new Date(params.timeRange.start)) return false;
        if (params.timeRange.end && date > new Date(params.timeRange.end)) return false;
        return true;
      });
    }

    // Group episodes by session
    const sessionMap = new Map<string, any[]>();
    for (const ep of episodes) {
      const sessionId = String(ep.metadata?.sessionId || 'unknown');
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, []);
      }
      sessionMap.get(sessionId)!.push(ep);
    }

    const sessions = Array.from(sessionMap.entries()).map(([sessionId, events]) => ({
      sessionId,
      eventCount: events.length,
      firstEvent: events[0]?.metadata?.timestamp,
      lastEvent: events[events.length - 1]?.metadata?.timestamp,
      projectName: events[0]?.metadata?.projectName,
      events: events.slice(0, 10), // Limit events per session
    }));

    return {
      success: true,
      totalEpisodes: episodes.length,
      sessions: sessions.sort((a, b) =>
        new Date(b.lastEvent || 0).getTime() - new Date(a.lastEvent || 0).getTime()
      ).slice(0, 20),
    };
  }

  private async handleListSkills(): Promise<any> {
    const homeDir = os.homedir();
    const skillsDir = path.join(homeDir, '.claude', 'skills');
    const skills: any[] = [];

    try {
      if (fs.existsSync(skillsDir)) {
        const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
            if (fs.existsSync(skillMdPath)) {
              const content = fs.readFileSync(skillMdPath, 'utf-8');

              // Parse YAML frontmatter
              const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
              let metadata: any = {};
              if (frontmatterMatch) {
                const lines = frontmatterMatch[1].split('\n');
                for (const line of lines) {
                  const [key, ...valueParts] = line.split(':');
                  if (key && valueParts.length > 0) {
                    metadata[key.trim()] = valueParts.join(':').trim();
                  }
                }
              }

              skills.push({
                name: entry.name,
                displayName: metadata.name || entry.name,
                description: metadata.description || '',
                allowedTools: metadata['allowed-tools'] || '',
                path: skillMdPath,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error listing skills:', error);
    }

    return {
      success: true,
      skillsDir,
      skills,
    };
  }

  private async handleManageSkill(params: any): Promise<any> {
    const homeDir = os.homedir();
    const skillsDir = path.join(homeDir, '.claude', 'skills');
    const skillPath = path.join(skillsDir, params.skillName);
    const skillMdPath = path.join(skillPath, 'SKILL.md');

    switch (params.action) {
      case 'view': {
        if (!fs.existsSync(skillMdPath)) {
          throw new Error(`Skill not found: ${params.skillName}`);
        }
        const content = fs.readFileSync(skillMdPath, 'utf-8');
        return {
          success: true,
          skillName: params.skillName,
          content,
        };
      }

      case 'add': {
        if (!params.content) {
          throw new Error('Content is required to add a skill');
        }
        if (!fs.existsSync(skillsDir)) {
          fs.mkdirSync(skillsDir, { recursive: true });
        }
        if (!fs.existsSync(skillPath)) {
          fs.mkdirSync(skillPath, { recursive: true });
        }
        fs.writeFileSync(skillMdPath, params.content);
        return {
          success: true,
          message: `Skill '${params.skillName}' created successfully`,
          path: skillMdPath,
        };
      }

      case 'update': {
        if (!params.content) {
          throw new Error('Content is required to update a skill');
        }
        if (!fs.existsSync(skillMdPath)) {
          throw new Error(`Skill not found: ${params.skillName}`);
        }
        fs.writeFileSync(skillMdPath, params.content);
        return {
          success: true,
          message: `Skill '${params.skillName}' updated successfully`,
        };
      }

      case 'remove': {
        if (!fs.existsSync(skillPath)) {
          throw new Error(`Skill not found: ${params.skillName}`);
        }
        fs.rmSync(skillPath, { recursive: true, force: true });
        return {
          success: true,
          message: `Skill '${params.skillName}' removed successfully`,
        };
      }

      default:
        throw new Error(`Unknown action: ${params.action}`);
    }
  }

  private async handleListHooks(): Promise<any> {
    const homeDir = os.homedir();
    const settingsPath = path.join(homeDir, '.claude', 'settings.json');
    const hooksDir = path.join(homeDir, '.claude', 'hooks');

    let settings: any = {};
    const hooks: any[] = [];

    try {
      // Read global settings
      if (fs.existsSync(settingsPath)) {
        const content = fs.readFileSync(settingsPath, 'utf-8');
        settings = JSON.parse(content);
      }

      // Parse hooks from settings
      if (settings.hooks) {
        for (const [eventType, hookConfigs] of Object.entries(settings.hooks)) {
          if (Array.isArray(hookConfigs)) {
            for (const config of hookConfigs) {
              hooks.push({
                eventType,
                matcher: (config as any).matcher || '*',
                type: (config as any).hooks?.[0]?.type || 'command',
                command: (config as any).hooks?.[0]?.command || '',
                active: true,
              });
            }
          }
        }
      }

      // List hook scripts
      const hookScripts: string[] = [];
      if (fs.existsSync(hooksDir)) {
        const entries = fs.readdirSync(hooksDir);
        hookScripts.push(...entries.filter(e => e.endsWith('.sh') || e.endsWith('.js')));
      }

      return {
        success: true,
        settingsPath,
        hooksDir,
        hooks,
        availableScripts: hookScripts,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list hooks',
        hooks: [],
      };
    }
  }

  private async handleGetJobStatus(params: any): Promise<any> {
    if (!this.fileProcessClient) {
      throw new Error('FileProcess client not initialized');
    }

    const job = await this.fileProcessClient.getJobStatus(params.jobId);
    return {
      success: true,
      job,
    };
  }

  // ============================================================================
  // Subscription/Plugin Access Handlers
  // ============================================================================

  private async handleCheckPluginAccess(params: any): Promise<AccessCheckResult> {
    if (!this.subscriptionClient) {
      // No subscription client - allow access by default (graceful degradation)
      return {
        allowed: true,
        message: 'Subscription checking not configured',
      };
    }

    return this.subscriptionClient.checkPluginAccess(params.pluginName, params.action);
  }

  private async handleGetUserSubscription(): Promise<UserSubscription | null> {
    if (!this.subscriptionClient) {
      return null;
    }

    return this.subscriptionClient.getUserSubscription();
  }

  private async handleGetMarketplacePlugins(params: any): Promise<any> {
    if (!this.subscriptionClient) {
      return { plugins: [] };
    }

    const plugins = await this.subscriptionClient.getMarketplacePlugins(params.category);
    return { plugins };
  }

  // ============================================================================
  // Settings Tab Handlers
  // ============================================================================

  private async handleGetCurrentUser(): Promise<CurrentUser | null> {
    if (!this.subscriptionClient) {
      return null;
    }

    return this.subscriptionClient.getCurrentUser();
  }

  private async handleGetApiKeys(): Promise<{ keys: ApiKey[] }> {
    if (!this.subscriptionClient) {
      return { keys: [] };
    }

    const keys = await this.subscriptionClient.getApiKeys();
    return { keys };
  }

  private async handleCreateApiKey(params: any): Promise<{ success: boolean; key?: string; keyData?: ApiKey; error?: string }> {
    if (!this.subscriptionClient) {
      return { success: false, error: 'Subscription client not configured' };
    }

    const result = await this.subscriptionClient.createApiKey(params.name, params.expiresInDays);
    if (result) {
      return {
        success: true,
        key: result.key,
        keyData: result.keyData,
      };
    }

    return { success: false, error: 'Failed to create API key' };
  }

  private async handleRevokeApiKey(params: any): Promise<{ success: boolean; error?: string }> {
    if (!this.subscriptionClient) {
      return { success: false, error: 'Subscription client not configured' };
    }

    const success = await this.subscriptionClient.revokeApiKey(params.keyId);
    if (success) {
      return { success: true };
    }

    return { success: false, error: 'Failed to revoke API key' };
  }
}
