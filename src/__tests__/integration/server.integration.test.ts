// src/__tests__/integration/server.integration.test.ts
// Integration tests for NexusCursorServer using dependency injection for testability

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NexusConfig } from '../../types.js';
import { NexusCursorServer, MCPServer, MCPServerFactory } from '../../server.js';

describe('NexusCursorServer Integration', () => {
  let server: NexusCursorServer;
  let mockConfig: NexusConfig;
  let mockFetch: ReturnType<typeof vi.fn>;

  // Mock MCP server instance for testing
  let mockMCPServer: MCPServer;
  let mockSetRequestHandler: ReturnType<typeof vi.fn>;
  let mockConnect: ReturnType<typeof vi.fn>;
  let mockClose: ReturnType<typeof vi.fn>;

  // Store the request handlers for testing
  let listToolsHandler: ((request?: any) => Promise<any>) | null = null;
  let callToolHandler: ((request?: any) => Promise<any>) | null = null;

  // Create mock server factory for dependency injection
  const createMockServerFactory = (): MCPServerFactory => {
    return (serverInfo, options) => {
      // Verify server info is passed correctly
      expect(serverInfo.name).toBe('nexus-cursor-plugin');
      expect(serverInfo.version).toBe('0.1.0');
      expect(options.capabilities.tools).toBeDefined();

      return mockMCPServer;
    };
  };

  beforeEach(() => {
    // Setup mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Setup mock MCP server methods
    // The MCP SDK schemas are Zod schemas with shape.method.values containing the method name
    mockSetRequestHandler = vi.fn().mockImplementation((schema, handler) => {
      const methodValues = schema?.shape?.method?.values;
      if (methodValues?.has?.('tools/list')) {
        listToolsHandler = handler;
      } else if (methodValues?.has?.('tools/call')) {
        callToolHandler = handler;
      }
    });
    mockConnect = vi.fn().mockResolvedValue(undefined);
    mockClose = vi.fn().mockResolvedValue(undefined);

    // Create mock MCP server instance
    mockMCPServer = {
      setRequestHandler: mockSetRequestHandler,
      connect: mockConnect,
      close: mockClose,
    };

    // Setup test config
    mockConfig = {
      apiKey: 'test-api-key-12345',
      endpoint: 'http://localhost:8080',
      workspaceRoot: '/test/workspace',
    };

    // Reset handlers
    listToolsHandler = null;
    callToolHandler = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Server Lifecycle', () => {
    it('should initialize server with correct configuration', () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      expect(server).toBeDefined();
      // Verify mock server factory was called (verified in factory)
    });

    it('should setup request handlers on initialization', () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      // Verify that request handlers were set up
      expect(mockSetRequestHandler).toHaveBeenCalledTimes(2);
      expect(listToolsHandler).not.toBeNull();
      expect(callToolHandler).not.toBeNull();
    });

    it('should connect to stdio transport on run', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      await server.run();

      expect(mockConnect).toHaveBeenCalled();
    });
  });

  describe('Tool Registration', () => {
    it('should register all required tools', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      expect(listToolsHandler).not.toBeNull();

      // Call the handler
      const result = await listToolsHandler!();

      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);

      // Verify all required tools are present
      const toolNames = result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('nexus_health');
      expect(toolNames).toContain('nexus_index_repository');
      expect(toolNames).toContain('nexus_query');
      expect(toolNames).toContain('nexus_explain_code');
      expect(toolNames).toContain('nexus_impact_analysis');
      expect(toolNames).toContain('nexus_file_history');
    });

    it('should return valid tool schemas', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      const result = await listToolsHandler!();

      result.tools.forEach((tool: any) => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
        expect(Array.isArray(tool.inputSchema.required)).toBe(true);
      });
    });
  });

  describe('Health Check Tool', () => {
    it('should execute health check before authentication', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authorized: true,
          user_id: 'test-user',
          email: 'test@example.com',
          tier: 'pro',
          rate_limit: 60,
          quotas: { tokens_per_month: 100000 },
        }),
      });

      const result = await callToolHandler!({
        params: {
          name: 'nexus_health',
          arguments: {},
        },
      });

      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe('text');

      // Parse health check response
      const healthData = JSON.parse(result.content[0].text);
      expect(healthData.status).toBe('healthy');
      expect(healthData.authenticated).toBe(true);
      expect(healthData.endpoint).toBe(mockConfig.endpoint);
    });

    it('should include authentication context in health check after auth', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authorized: true,
          user_id: 'test-user',
          email: 'test@example.com',
          tier: 'enterprise',
          rate_limit: 120,
          quotas: { tokens_per_month: 500000 },
        }),
      });

      const result = await callToolHandler!({
        params: {
          name: 'nexus_health',
          arguments: {},
        },
      });

      const healthData = JSON.parse(result.content[0].text);
      expect(healthData.user).toBe('test@example.com');
      expect(healthData.tier).toBe('enterprise');
    });
  });

  describe('Authentication Flow', () => {
    it('should authenticate before executing tools', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      // Mock successful authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authorized: true,
          user_id: 'test-user',
          email: 'test@example.com',
          tier: 'free',
          rate_limit: 30,
        }),
      });

      // Execute any tool (should trigger auth)
      await callToolHandler!({
        params: {
          name: 'nexus_query',
          arguments: { query: 'test query' },
        },
      });

      // Verify authentication was called
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/internal/plugins/validate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key-12345',
          }),
          body: expect.stringContaining('cursor-ide'),
        })
      );
    });

    it('should handle authentication failure gracefully', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      // Mock failed authentication
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid API key',
      });

      const result = await callToolHandler!({
        params: {
          name: 'nexus_query',
          arguments: { query: 'test query' },
        },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Authentication failed');
    });

    it('should handle unauthorized API keys', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      // Mock unauthorized response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authorized: false,
          user_id: 'test-user',
        }),
      });

      const result = await callToolHandler!({
        params: {
          name: 'nexus_query',
          arguments: { query: 'test query' },
        },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not authorized');
    });

    it('should cache authentication context across tool calls', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      // Mock authentication (should only be called once)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authorized: true,
          user_id: 'test-user',
          email: 'test@example.com',
          tier: 'pro',
        }),
      });

      // First tool call (triggers auth)
      await callToolHandler!({
        params: {
          name: 'nexus_health',
          arguments: {},
        },
      });

      // Second tool call (uses cached auth)
      await callToolHandler!({
        params: {
          name: 'nexus_health',
          arguments: {},
        },
      });

      // Authentication should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool names gracefully', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      // Mock authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authorized: true,
          user_id: 'test-user',
          tier: 'pro',
        }),
      });

      const result = await callToolHandler!({
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });

    it('should handle network errors during authentication', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await callToolHandler!({
        params: {
          name: 'nexus_query',
          arguments: { query: 'test' },
        },
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error');
    });

    it('should return error for tools not yet implemented', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      // Mock authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          authorized: true,
          user_id: 'test-user',
        }),
      });

      // Test unimplemented tool
      const result = await callToolHandler!({
        params: {
          name: 'nexus_index_repository',
          arguments: { path: '/test/path' },
        },
      });

      expect(result.content[0].text).toContain('not yet implemented');
    });
  });

  describe('Tool Execution', () => {
    beforeEach(() => {
      // Mock successful authentication for all tests
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          authorized: true,
          user_id: 'test-user',
          email: 'test@example.com',
          tier: 'pro',
        }),
      });
    });

    it('should execute nexus_query tool', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      const result = await callToolHandler!({
        params: {
          name: 'nexus_query',
          arguments: { query: 'How does authentication work?' },
        },
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Query received');
    });

    it('should execute nexus_explain_code tool', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      const result = await callToolHandler!({
        params: {
          name: 'nexus_explain_code',
          arguments: {
            filePath: '/test/file.ts',
            startLine: 10,
            endLine: 20,
          },
        },
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('not yet implemented');
    });

    it('should execute nexus_impact_analysis tool', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      const result = await callToolHandler!({
        params: {
          name: 'nexus_impact_analysis',
          arguments: {
            symbol: 'calculateTotal',
            filePath: '/test/file.ts',
          },
        },
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('Impact analysis');
    });

    it('should execute nexus_file_history tool', async () => {
      server = new NexusCursorServer(mockConfig, createMockServerFactory());

      const result = await callToolHandler!({
        params: {
          name: 'nexus_file_history',
          arguments: {
            filePath: '/test/file.ts',
            limit: 10,
          },
        },
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('not yet implemented');
    });
  });
});
