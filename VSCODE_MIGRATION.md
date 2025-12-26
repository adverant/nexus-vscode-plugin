# VSCode Migration from Cursor Plugin

This document describes the migration from the Cursor IDE MCP plugin to a native VSCode extension with GraphRAG Enhanced support.

## Changes Made

### 1. Package Configuration

**File**: `package.json`

**Changes**:
- Renamed from `@adverant/nexus-cursor-plugin` to `@adverant/nexus-vscode-plugin`
- Added VSCode-specific fields:
  - `displayName`: "Nexus - GraphRAG Code Intelligence"
  - `publisher`: "adverant"
  - `engines.vscode`: "^1.85.0"
  - `activationEvents`: ["onStartupFinished"]
- Removed MCP SDK dependency (Cursor-specific)
- Added `@types/vscode` and `@vscode/vsce` dependencies
- Changed `main` from `dist/index.js` to `dist/extension.js`

### 2. VSCode Extension Manifest

**Added** (`package.json` "contributes" section):

#### Commands
- `nexus.storeMemory` - Store code snippets/memories
- `nexus.recallMemory` - Semantic memory search
- `nexus.enhancedSearch` - Enhanced RAG search with query rewriting
- `nexus.analyzeQuery` - Query complexity analysis
- `nexus.showNexusMind` - Interactive code visualization
- `nexus.configure` - API configuration

#### Configuration
- `nexus.apiEndpoint` - Nexus API URL (default: https://api.adverant.ai)
- `nexus.enhancedApiEndpoint` - GraphRAG Enhanced URL (default: http://localhost:9051)
- `nexus.companyId` - Tenant company ID
- `nexus.appId` - Application ID
- `nexus.enableEnhancedRAG` - Enable query enhancement features
- `nexus.enableQwen` - Use Qwen2.5 72B for query enhancement
- `nexus.ollamaEndpoint` - Ollama API endpoint for Qwen
- `nexus.autoCapture` - Auto-capture code changes

#### Views
- **Activity Bar**: Nexus icon in sidebar
- **Nexus Panel**:
  - Memories view - Browse stored memories
  - NexusMind view - Interactive code visualization

### 3. GraphRAG Enhanced Integration

**New Features**:
1. **Enhanced Search**: Query rewriting, HyDE, self-correction
2. **Qwen2.5 72B Support**: Local Ollama integration for query enhancement
3. **RAG Triad Evaluation**: Context relevance, groundedness, answer relevance
4. **Adaptive Routing**: Intelligent query routing (direct_llm, keyword_only, semantic_only, full_pipeline)
5. **Memory Management**: Store and recall code snippets with semantic search

### 4. Architecture Differences

#### Cursor Plugin (MCP-based)
```
Cursor IDE → MCP Protocol → GraphRAG Service
```

#### VSCode Plugin (Extension API)
```
VSCode → Extension API → GraphRAG Enhanced → GraphRAG Service → Qwen2.5 72B (Ollama)
```

**Benefits**:
- Native VSCode integration (no MCP protocol overhead)
- Direct GraphRAG Enhanced access
- Local Qwen2.5 72B for query enhancement
- Better performance and lower latency

### 5. Implementation Plan

#### Phase 1: Core Extension (In Progress)
- ✅ Package.json configuration
- ⏳ Extension activation and commands
- ⏳ Configuration management
- ⏳ API client for GraphRAG/GraphRAG Enhanced

#### Phase 2: Memory Management
- ⏳ Store memory command
- ⏳ Recall memory command
- ⏳ Memories tree view
- ⏳ Auto-capture on code changes

#### Phase 3: Enhanced Search
- ⏳ Enhanced search command with query rewriting
- ⏳ HyDE document generation
- ⏳ Self-correction loop
- ⏳ RAG Triad evaluation UI

#### Phase 4: Qwen Integration
- ⏳ Ollama client for Qwen2.5 72B
- ⏳ Query enhancement with Qwen
- ⏳ Fallback to OpenRouter if Ollama unavailable

#### Phase 5: NexusMind Visualization
- ⏳ Dependency graph webview
- ⏳ Evolution timeline
- ⏳ Impact ripple visualization
- ⏳ Semantic clustering

#### Phase 6: Testing & Publishing
- ⏳ Integration testing on macOS M4 Max
- ⏳ Package extension (.vsix)
- ⏳ Publish to VSCode Marketplace
- ⏳ GitHub repo setup (public)

## File Structure

```
nexus-vscode-plugin/
├── src/
│   ├── extension.ts          # NEW: VSCode extension entry point
│   ├── commands/              # NEW: Command handlers
│   │   ├── store-memory.ts
│   │   ├── recall-memory.ts
│   │   ├── enhanced-search.ts
│   │   └── nexusmind.ts
│   ├── clients/
│   │   ├── graphrag-client.ts
│   │   ├── graphrag-enhanced-client.ts  # NEW
│   │   └── ollama-client.ts              # NEW
│   ├── views/
│   │   ├── memories-view.ts              # NEW
│   │   └── nexusmind-view.ts
│   ├── utils/
│   │   ├── config.ts
│   │   └── logger.ts
│   └── types/
│       └── index.ts
├── resources/                 # Icons and assets
├── docs/
├── package.json
├── tsconfig.json
└── README.md
```

## Configuration Example

**User Settings** (`.vscode/settings.json`):
```json
{
  "nexus.apiEndpoint": "https://api.adverant.ai",
  "nexus.enhancedApiEndpoint": "http://localhost:9051",
  "nexus.companyId": "adverant",
  "nexus.appId": "vscode-nexus",
  "nexus.enableEnhancedRAG": true,
  "nexus.enableQwen": true,
  "nexus.ollamaEndpoint": "http://localhost:11434",
  "nexus.autoCapture": true
}
```

**API Key Storage**:
API keys are stored in VSCode's SecretStorage:
```typescript
await context.secrets.store('nexus-api-key', apiKey);
const apiKey = await context.secrets.get('nexus-api-key');
```

## Testing Plan

### Prerequisites
- Qwen2.5 72B installed via Ollama (`ollama pull qwen2.5:72b`)
- GraphRAG Enhanced service running on port 9051 (optional)
- Adverant API key configured

### Test Scenarios

1. **Memory Storage**:
   - Select code snippet
   - Run "Nexus: Store Memory"
   - Verify memory appears in Memories view

2. **Memory Recall**:
   - Run "Nexus: Recall Memory"
   - Enter query: "How to implement authentication?"
   - Verify relevant memories returned with scores

3. **Enhanced Search**:
   - Run "Nexus: Enhanced Search"
   - Enter query: "user registration endpoint"
   - Verify query enhancement and quality scores

4. **Query Analysis**:
   - Run "Nexus: Analyze Query"
   - Enter query: "Compare PostgreSQL vs MongoDB"
   - Verify routing decision and complexity analysis

5. **NexusMind Visualization**:
   - Run "Nexus: Show NexusMind"
   - Open dependency graph for current file
   - Verify interactive visualization

6. **Qwen Integration** (if enabled):
   - Ensure Ollama is running
   - Run enhanced search
   - Verify Qwen is used for query rewriting

## Deployment

### Local Installation
```bash
# Build extension
cd /Users/don/Adverant/nexus-vscode-plugin
npm install
npm run build

# Package extension
npm run package
# Creates: adverant.nexus-vscode-plugin-0.1.0.vsix

# Install in VSCode
code --install-extension adverant.nexus-vscode-plugin-0.1.0.vsix
```

### Marketplace Publishing
```bash
# Get Personal Access Token from Azure DevOps
# https://dev.azure.com/<org>/_usersSettings/tokens

# Login to vsce
npx vsce login adverant

# Publish
npm run publish
```

## Migration Checklist

- [x] Update package.json for VSCode
- [x] Add VSCode commands and configuration
- [x] Add activity bar and views
- [ ] Create extension.ts entry point
- [ ] Implement command handlers
- [ ] Create GraphRAG Enhanced client
- [ ] Create Ollama/Qwen client
- [ ] Implement memory views
- [ ] Implement NexusMind visualization
- [ ] Add auto-capture functionality
- [ ] Write tests
- [ ] Test on macOS M4 Max
- [ ] Package extension
- [ ] Create GitHub repo (public)
- [ ] Publish to marketplace

## Repository Setup

**GitHub**: https://github.com/adverant/nexus-vscode-plugin

**Branches**:
- `main` - Stable releases
- `develop` - Active development
- `feature/*` - Feature branches

**CI/CD**:
- GitHub Actions for automated testing
- Auto-publish to marketplace on tag

## License

MIT License (same as Cursor plugin)
