#!/usr/bin/env node
// src/index.ts
import { NexusCursorServer } from './server.js';
import type { NexusConfig } from './types.js';

const config: NexusConfig = {
  apiKey: process.env.NEXUS_API_KEY || '',
  endpoint: process.env.NEXUS_ENDPOINT || 'https://api.adverant.ai',
  workspaceRoot: process.env.WORKSPACE_ROOT || process.cwd(),
};

if (!config.apiKey) {
  console.error('Error: NEXUS_API_KEY environment variable is required');
  console.error('Get your API key at: https://adverant.ai/settings/api-keys');
  process.exit(1);
}

const server = new NexusCursorServer(config);
server.run().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
