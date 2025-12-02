// src/__tests__/integration/query-flow.integration.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryHandler, QueryOptions } from '../../handlers/query-handler.js';
import { GraphRAGClient, SearchResult } from '../../clients/graphrag-client.js';
import axios from 'axios';

// Mock axios module (used by GraphRAGClient)
vi.mock('axios');

describe('Query Flow Integration', () => {
  let queryHandler: QueryHandler;
  let graphRAGClient: GraphRAGClient;
  let mockPost: ReturnType<typeof vi.fn>;
  let mockGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup axios mock instance
    mockPost = vi.fn();
    mockGet = vi.fn();
    const mockAxiosInstance = {
      post: mockPost,
      get: mockGet,
      put: vi.fn(),
      delete: vi.fn(),
    };

    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any);

    // Create real GraphRAGClient (it will use mocked axios)
    graphRAGClient = new GraphRAGClient('http://localhost:8080', 'test-key');

    // Create QueryHandler with the real (but axios-mocked) client
    queryHandler = new QueryHandler(graphRAGClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Natural Language Query Processing', () => {
    it('should process a simple natural language query', async () => {
      // Mock GraphRAG retrieve response
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'The authentication system uses JWT tokens for secure access.',
          sources: [
            {
              id: 'source-1',
              content: 'Authentication middleware validates JWT tokens',
              score: 0.92,
              metadata: {
                filePath: '/src/auth/middleware.ts',
                startLine: 10,
                endLine: 25,
                language: 'typescript',
                type: 'function',
              },
            },
            {
              id: 'source-2',
              content: 'JWT token generation in auth service',
              score: 0.88,
              metadata: {
                filePath: '/src/auth/service.ts',
                startLine: 50,
                endLine: 75,
                language: 'typescript',
                type: 'function',
              },
            },
          ],
        },
      });

      const result = await queryHandler.query('How does authentication work?');

      expect(result).toBeDefined();
      expect(result.query).toBe('How does authentication work?');
      expect(result.summary).toContain('JWT tokens');
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.totalResults).toBeGreaterThan(0);
      // Execution time might be 0ms in fast test environments where operations
      // complete within the same millisecond, so we use >= 0
      expect(result.executionTime).toBeGreaterThanOrEqual(0);

      // Verify GraphRAG was called with hybrid strategy
      expect(mockPost).toHaveBeenCalledWith(
        '/api/retrieve',
        expect.objectContaining({
          query: expect.stringContaining('authentication'),
          strategy: 'hybrid',
        })
      );
    });

    it('should format results correctly', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Database connection is managed by connection pool.',
          sources: [
            {
              id: 'db-1',
              content: '```typescript\nconst pool = new Pool(config);\n```',
              score: 0.95,
              metadata: {
                filePath: '/src/db/connection.ts',
                startLine: 15,
                endLine: 20,
                language: 'typescript',
                type: 'variable',
                symbols: ['pool', 'Pool'],
              },
            },
          ],
        },
      });

      const result = await queryHandler.query('How is database connection managed?', {
        includeSnippets: true,
      });

      const firstResult = result.results[0];
      expect(firstResult).toBeDefined();
      expect(firstResult.id).toBe('db-1');
      expect(firstResult.filePath).toBe('/src/db/connection.ts');
      expect(firstResult.lineNumber).toBe(15);
      expect(firstResult.endLine).toBe(20);
      expect(firstResult.code).toContain('Pool');
      expect(firstResult.confidence).toBeGreaterThan(0);
      expect(firstResult.metadata.language).toBe('typescript');
      expect(firstResult.metadata.symbols).toContain('pool');
    });

    it('should rank results by confidence', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Multiple logging strategies are used.',
          sources: [
            {
              id: 'log-1',
              content: 'Low confidence result',
              score: 0.45,
              metadata: {
                filePath: '/src/utils/logger.ts',
                startLine: 1,
              },
            },
            {
              id: 'log-2',
              content: 'High confidence result',
              score: 0.95,
              metadata: {
                filePath: '/src/core/logging.ts',
                startLine: 10,
              },
            },
            {
              id: 'log-3',
              content: 'Medium confidence result',
              score: 0.70,
              metadata: {
                filePath: '/src/services/log-service.ts',
                startLine: 5,
              },
            },
          ],
        },
      });

      const result = await queryHandler.query('How is logging implemented?');

      // Results should be sorted by confidence (highest first)
      expect(result.results[0].id).toBe('log-2');
      expect(result.results[0].confidence).toBeGreaterThan(result.results[1].confidence);
      expect(result.results[1].confidence).toBeGreaterThan(result.results[2].confidence);
    });

    it('should respect limit option', async () => {
      // Generate many results
      const sources = Array.from({ length: 50 }, (_, i) => ({
        id: `result-${i}`,
        content: `Result ${i}`,
        score: 0.5 + (i * 0.01),
        metadata: { filePath: `/src/file${i}.ts` },
      }));

      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Many results available.',
          sources,
        },
      });

      const result = await queryHandler.query('test query', { limit: 10 });

      expect(result.results.length).toBeLessThanOrEqual(10);
      expect(result.totalResults).toBe(50);
    });

    it('should calculate max confidence correctly', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Test results.',
          sources: [
            { id: 'r1', content: 'a', score: 0.75, metadata: { filePath: '/a.ts' } },
            { id: 'r2', content: 'b', score: 0.95, metadata: { filePath: '/b.ts' } },
            { id: 'r3', content: 'c', score: 0.60, metadata: { filePath: '/c.ts' } },
          ],
        },
      });

      const result = await queryHandler.query('test');

      expect(result.maxConfidence).toBeGreaterThan(0);
      // Max confidence should be based on highest score (0.95)
      expect(result.maxConfidence).toBeGreaterThan(90);
    });
  });

  describe('Filter Options', () => {
    it('should filter results by language', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Mixed language results.',
          sources: [
            {
              id: 'ts-1',
              content: 'TypeScript code',
              score: 0.9,
              metadata: { filePath: '/src/app.ts', language: 'typescript' },
            },
            {
              id: 'py-1',
              content: 'Python code',
              score: 0.85,
              metadata: { filePath: '/scripts/script.py', language: 'python' },
            },
            {
              id: 'ts-2',
              content: 'More TypeScript',
              score: 0.88,
              metadata: { filePath: '/src/utils.tsx', language: 'typescript' },
            },
          ],
        },
      });

      const result = await queryHandler.query('find functions', {
        language: 'typescript',
      });

      // Should only include TypeScript results
      result.results.forEach((r) => {
        expect(
          r.metadata.language === 'typescript' ||
          r.filePath.endsWith('.ts') ||
          r.filePath.endsWith('.tsx')
        ).toBe(true);
      });

      expect(result.results.length).toBeLessThan(3); // Python result filtered out
    });

    it('should filter results by file type', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Mixed file types.',
          sources: [
            {
              id: 'ts-1',
              content: 'TS file',
              score: 0.9,
              metadata: { filePath: '/src/app.ts' },
            },
            {
              id: 'js-1',
              content: 'JS file',
              score: 0.85,
              metadata: { filePath: '/src/legacy.js' },
            },
          ],
        },
      });

      const result = await queryHandler.query('test', { fileType: '.ts' });

      result.results.forEach((r) => {
        expect(r.filePath.endsWith('.ts')).toBe(true);
      });
    });

    it('should filter results by directory', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Mixed directories.',
          sources: [
            {
              id: 'src-1',
              content: 'Source file',
              score: 0.9,
              metadata: { filePath: '/src/services/api.ts' },
            },
            {
              id: 'test-1',
              content: 'Test file',
              score: 0.85,
              metadata: { filePath: '/tests/api.test.ts' },
            },
            {
              id: 'src-2',
              content: 'Another source',
              score: 0.88,
              metadata: { filePath: '/src/utils/helper.ts' },
            },
          ],
        },
      });

      const result = await queryHandler.query('test', { directory: 'src' });

      result.results.forEach((r) => {
        expect(r.filePath).toContain('src');
      });
    });

    it('should combine multiple filters', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Mixed results.',
          sources: [
            {
              id: '1',
              content: 'Match',
              score: 0.9,
              metadata: {
                filePath: '/src/services/auth.ts',
                language: 'typescript',
              },
            },
            {
              id: '2',
              content: 'No match - wrong dir',
              score: 0.85,
              metadata: {
                filePath: '/tests/auth.ts',
                language: 'typescript',
              },
            },
            {
              id: '3',
              content: 'No match - wrong lang',
              score: 0.88,
              metadata: {
                filePath: '/src/services/script.py',
                language: 'python',
              },
            },
          ],
        },
      });

      const result = await queryHandler.query('test', {
        language: 'typescript',
        directory: 'src/services',
      });

      // Should only have the one matching result
      expect(result.results.length).toBe(1);
      expect(result.results[0].id).toBe('1');
    });

    it('should build enhanced query with filter context', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Results.',
          sources: [],
        },
      });

      await queryHandler.query('find functions', {
        language: 'python',
        directory: 'src/utils',
      });

      // Verify enhanced query includes filter hints
      const callArgs = mockPost.mock.calls[0][1];
      expect(callArgs.query).toContain('python');
      expect(callArgs.query).toContain('src/utils');
    });
  });

  describe('Semantic Search', () => {
    it('should perform semantic search for code patterns', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          results: [
            {
              id: 'pattern-1',
              content: 'Function using async/await pattern',
              score: 0.92,
              metadata: {
                filePath: '/src/async-handler.ts',
                type: 'function',
              },
            },
            {
              id: 'pattern-2',
              content: 'Another async function',
              score: 0.87,
              metadata: {
                filePath: '/src/utils.ts',
                type: 'function',
              },
            },
          ],
        },
      });

      const result = await queryHandler.semanticSearch('async await pattern');

      expect(result).toBeDefined();
      expect(result.term).toBe('async await pattern');
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.totalResults).toBe(result.results.length);

      // Verify search was called with correct query
      expect(mockPost).toHaveBeenCalledWith(
        '/api/search',
        expect.objectContaining({
          query: expect.stringContaining('async await pattern'),
          limit: expect.any(Number),
        })
      );
    });

    it('should rank semantic search by relevance', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          results: [
            {
              id: 'r1',
              content: 'Low relevance',
              score: 0.55,
              metadata: { filePath: '/a.ts' },
            },
            {
              id: 'r2',
              content: 'High relevance',
              score: 0.95,
              metadata: { filePath: '/b.ts', type: 'function' },
            },
            {
              id: 'r3',
              content: 'Medium relevance',
              score: 0.75,
              metadata: { filePath: '/c.ts', language: 'typescript' },
            },
          ],
        },
      });

      const result = await queryHandler.semanticSearch('test pattern');

      // Should be sorted by relevance (descending)
      expect(result.results[0].relevance).toBeGreaterThan(result.results[1].relevance);
      expect(result.results[1].relevance).toBeGreaterThan(result.results[2].relevance);
    });

    it('should apply filters to semantic search', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          results: [
            {
              id: 'ts-1',
              content: 'TypeScript',
              score: 0.9,
              metadata: { filePath: '/src/app.ts', language: 'typescript' },
            },
            {
              id: 'js-1',
              content: 'JavaScript',
              score: 0.85,
              metadata: { filePath: '/src/app.js', language: 'javascript' },
            },
          ],
        },
      });

      const result = await queryHandler.semanticSearch('error handling', {
        language: 'typescript',
      });

      result.results.forEach((r) => {
        expect(
          r.metadata.language === 'typescript' || r.filePath.endsWith('.ts')
        ).toBe(true);
      });
    });

    it('should respect limit in semantic search', async () => {
      const manyResults = Array.from({ length: 30 }, (_, i) => ({
        id: `r${i}`,
        content: `Result ${i}`,
        score: 0.5 + (i * 0.01),
        metadata: { filePath: `/file${i}.ts` },
      }));

      mockPost.mockResolvedValueOnce({
        data: { results: manyResults },
      });

      const result = await queryHandler.semanticSearch('pattern', { limit: 5 });

      expect(result.results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Result Formatting and Enrichment', () => {
    it('should extract code snippets from content', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Code examples.',
          sources: [
            {
              id: 'snippet-1',
              content: '```typescript\nfunction test() {\n  return 42;\n}\n```',
              score: 0.9,
              metadata: { filePath: '/test.ts' },
            },
          ],
        },
      });

      const result = await queryHandler.query('test', { includeSnippets: true });

      expect(result.results[0].code).toBeDefined();
      expect(result.results[0].code).toContain('function test()');
      expect(result.results[0].code).not.toContain('```');
    });

    it('should handle content without code blocks', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Plain description.',
          sources: [
            {
              id: 'plain-1',
              content: 'This is a plain text description without code blocks',
              score: 0.9,
              metadata: { filePath: '/test.ts' },
            },
          ],
        },
      });

      const result = await queryHandler.query('test', { includeSnippets: true });

      expect(result.results[0].code).toBeDefined();
      expect(result.results[0].code).toContain('plain text description');
    });

    it('should extract metadata fields correctly', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Metadata test.',
          sources: [
            {
              id: 'meta-1',
              content: 'Test content',
              score: 0.9,
              metadata: {
                filePath: '/src/utils.ts',
                startLine: 10,
                endLine: 20,
                language: 'typescript',
                type: 'function',
                symbols: ['add', 'subtract'],
                tags: ['math', 'utility'],
              },
            },
          ],
        },
      });

      const result = await queryHandler.query('test');

      const firstResult = result.results[0];
      expect(firstResult.metadata.language).toBe('typescript');
      expect(firstResult.metadata.type).toBe('function');
      expect(firstResult.metadata.symbols).toEqual(['add', 'subtract']);
      expect(firstResult.metadata.tags).toEqual(['math', 'utility']);
    });

    it('should handle missing metadata gracefully', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Minimal metadata.',
          sources: [
            {
              id: 'minimal-1',
              content: 'Test content',
              score: 0.9,
              metadata: {},
            },
          ],
        },
      });

      const result = await queryHandler.query('test');

      // Should not crash, but result might be filtered out if no file path
      expect(result).toBeDefined();
    });

    it('should skip results without file paths', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Mixed results.',
          sources: [
            {
              id: 'valid-1',
              content: 'Valid result',
              score: 0.9,
              metadata: { filePath: '/src/test.ts' },
            },
            {
              id: 'invalid-1',
              content: 'Invalid result',
              score: 0.85,
              metadata: {}, // No file path
            },
            {
              id: 'valid-2',
              content: 'Another valid',
              score: 0.88,
              metadata: { file: '/src/test2.ts' }, // Alternative field name
            },
          ],
        },
      });

      const result = await queryHandler.query('test');

      // Should only include results with file paths
      result.results.forEach((r) => {
        expect(r.filePath).toBeDefined();
        expect(r.filePath.length).toBeGreaterThan(0);
      });
    });

    it('should calculate confidence scores correctly', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Score test.',
          sources: [
            {
              id: 'high-1',
              content: 'High score',
              score: 0.95,
              metadata: { filePath: '/high.ts' },
            },
            {
              id: 'low-1',
              content: 'Low score',
              score: 0.35,
              metadata: { filePath: '/low.ts' },
            },
          ],
        },
      });

      const result = await queryHandler.query('test');

      // High score should result in high confidence
      const highResult = result.results.find((r) => r.id === 'high-1');
      expect(highResult?.confidence).toBeGreaterThan(80);

      // Low score should result in lower confidence
      const lowResult = result.results.find((r) => r.id === 'low-1');
      if (lowResult) {
        expect(lowResult.confidence).toBeLessThan(highResult!.confidence);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle GraphRAG retrieval errors', async () => {
      mockPost.mockRejectedValueOnce(new Error('GraphRAG service unavailable'));

      await expect(queryHandler.query('test query')).rejects.toThrow(
        'Query failed'
      );
    });

    it('should handle search errors', async () => {
      mockPost.mockRejectedValueOnce(new Error('Search service error'));

      await expect(queryHandler.semanticSearch('test')).rejects.toThrow(
        'Semantic search failed'
      );
    });

    it('should handle empty results gracefully', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'No results found.',
          sources: [],
        },
      });

      const result = await queryHandler.query('nonexistent query');

      expect(result.results).toEqual([]);
      expect(result.totalResults).toBe(0);
      expect(result.maxConfidence).toBe(0);
    });

    it('should continue processing despite individual result formatting errors', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Mixed quality results.',
          sources: [
            {
              id: 'good-1',
              content: 'Good result',
              score: 0.9,
              metadata: { filePath: '/good.ts' },
            },
            {
              id: 'bad-1',
              content: 'Bad result',
              score: 0.85,
              metadata: null, // Invalid metadata
            },
            {
              id: 'good-2',
              content: 'Another good result',
              score: 0.88,
              metadata: { filePath: '/good2.ts' },
            },
          ],
        },
      });

      const result = await queryHandler.query('test');

      // Should have processed the good results
      expect(result.results.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Timing', () => {
    it('should track execution time accurately', async () => {
      mockPost.mockImplementation(async () => {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          data: {
            content: 'Results.',
            sources: [
              {
                id: 'r1',
                content: 'Result',
                score: 0.9,
                metadata: { filePath: '/test.ts' },
              },
            ],
          },
        };
      });

      const result = await queryHandler.query('test');

      expect(result.executionTime).toBeGreaterThan(0);
      // Allow slight timing variance due to JavaScript timer precision
      // setTimeout(50) typically completes within 49-55ms
      expect(result.executionTime).toBeGreaterThanOrEqual(45);
    });

    it('should return results without unnecessary delays', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          content: 'Quick results.',
          sources: [
            {
              id: 'r1',
              content: 'Result',
              score: 0.9,
              metadata: { filePath: '/test.ts' },
            },
          ],
        },
      });

      const startTime = Date.now();
      await queryHandler.query('test');
      const duration = Date.now() - startTime;

      // Should complete quickly (< 1 second for mocked response)
      expect(duration).toBeLessThan(1000);
    });
  });
});
