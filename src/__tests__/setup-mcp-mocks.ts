// src/__tests__/setup-mcp-mocks.ts
// This file sets up MCP SDK mocks for integration tests

import { vi } from 'vitest';

// Mock functions that can be accessed by tests
export const mockSetRequestHandler = vi.fn();
export const mockConnect = vi.fn().mockResolvedValue(undefined);
export const mockClose = vi.fn().mockResolvedValue(undefined);

// Reset function for tests
export function resetMcpMocks() {
  mockSetRequestHandler.mockClear();
  mockConnect.mockClear();
  mockClose.mockClear();
}

// Mock Server class
export class MockMcpServer {
  setRequestHandler = mockSetRequestHandler;
  connect = mockConnect;
  close = mockClose;

  constructor(_serverInfo: unknown, _options: unknown) {
    // Constructor is intentionally empty - stores no state
  }
}

// Mock transport
export class MockStdioServerTransport {
  constructor() {
    // Constructor is intentionally empty
  }
}
