# Nexus VSCode Plugin - Porting Status

**Date**: December 26, 2025
**Source**: nexus-cursor-plugin (MCP Server)
**Target**: nexus-vscode-plugin (VSCode Extension)

---

## Overview

The nexus-cursor-plugin is a comprehensive MCP (Model Context Protocol) server with 12+ major features. This document tracks the porting progress to a native VSCode extension.

---

## Features Ported (Source Files Copied)

### ✅ Core Services (100% copied)

| Feature | Source Files | Status | Notes |
|---------|--------------|--------|-------|
| **GraphRAG Client** | `src/clients/graphrag-client.ts` | ✅ Copied | HTTP client, needs adaptation |
| **MageAgent Client** | `src/clients/mageagent-client.ts` | ✅ Copied | Multi-model AI orchestration |
| **Ollama Client** | `src/clients/ollama-client.ts` | ✅ Copied | Qwen2.5 72B integration |
| **Git Service** | `src/git/git-service.ts` | ✅ Copied | simple-git wrapper, adapt to VSCode Git API |
| **Tree-Sitter Parser** | `src/parsers/tree-sitter-service.ts` | ✅ Copied | 6 language support |
| **Repository Indexer** | `src/indexer/repository-indexer.ts` | ✅ Copied | Full repo scanning |

### ✅ Handlers (100% copied)

| Handler | Source File | Status | Adaptation Required |
|---------|-------------|--------|---------------------|
| **Episodic Memory** | `src/handlers/episodic-memory.ts` | ✅ Copied | Remove MCP schema, add VSCode commands |
| **Impact Analysis** | `src/handlers/impact-analysis.ts` | ✅ Copied | Remove MCP schema, add WebView |
| **Query Handler** | `src/handlers/query-handler.ts` | ✅ Copied | Remove MCP schema, add command |
| **Visualization Handler** | `src/handlers/visualization-handler.ts` | ✅ Copied | Remove MCP, create WebView panels |

### ✅ Visualization Engines (100% copied)

| Visualization | Source File | Status | VSCode Integration |
|---------------|-------------|--------|-------------------|
| **Dependency Graph** | `src/visualization/dependency-graph.ts` | ✅ Copied | WebView with D3.js |
| **Evolution Timeline** | `src/visualization/evolution-timeline.ts` | ✅ Copied | WebView timeline |
| **Impact Ripple** | `src/visualization/impact-ripple.ts` | ✅ Copied | WebView canvas |
| **Semantic Clusters** | `src/visualization/semantic-clusters.ts` | ✅ Copied | WebView clustering |
| **Architecture Advisor** | `src/visualization/architecture-advisor.ts` | ✅ Copied | Diagnostic panel |
| **NL Query** | `src/visualization/nl-graph-query.ts` | ✅ Copied | Command/chat interface |
| **Graph Engine** | `src/visualization/graph-engine.ts` | ✅ Copied | Core graph logic |
| **Layout Algorithms** | `src/visualization/layout-algorithms.ts` | ✅ Copied | 4 layout types |

### ✅ Tools (100% copied)

| Tool | Source File | Status | VSCode Integration |
|------|-------------|--------|-------------------|
| **Security Scanner** | `src/tools/security-scanner.ts` | ✅ Copied | Command + diagnostic |
| **Test Generator** | `src/tools/test-generator.ts` | ✅ Copied | Command + quick fix |

---

## Commands Defined in package.json

### ✅ Core Commands (6 commands)

1. ✅ `nexus.storeMemory` - Store code snippets as memories
2. ✅ `nexus.recallMemory` - Semantic memory search
3. ✅ `nexus.enhancedSearch` - Enhanced RAG search
4. ✅ `nexus.analyzeQuery` - Query complexity analysis
5. ✅ `nexus.showNexusMind` - NexusMind visualization
6. ✅ `nexus.configure` - API key configuration

### ✅ Advanced Commands (8 commands)

7. ✅ `nexus.indexRepository` - Full repository indexing
8. ✅ `nexus.queryKnowledgeGraph` - Natural language queries
9. ✅ `nexus.explainCode` - Code explanation with history
10. ✅ `nexus.impactAnalysis` - Change impact analysis
11. ✅ `nexus.fileHistory` - File evolution timeline
12. ✅ `nexus.securityScan` - Vulnerability scanning
13. ✅ `nexus.generateTests` - AI test generation
14. ✅ (Reserved for future)

### ✅ NexusMind Visualization Commands (6 commands)

15. ✅ `nexus.dependencyGraph` - Interactive dependency visualization
16. ✅ `nexus.evolutionTimeline` - Code history over time
17. ✅ `nexus.impactRipple` - Change propagation rings
18. ✅ `nexus.semanticClusters` - AI-powered code grouping
19. ✅ `nexus.architectureAnalyze` - Code smell detection
20. ✅ `nexus.nlQuery` - Natural language graph queries

**Total**: 20 commands defined in package.json

---

## Dependencies Added

### ✅ Runtime Dependencies

```json
{
  "axios": "^1.6.0",           // HTTP client
  "glob": "^13.0.0",            // File discovery
  "pino": "^8.17.0",            // Logging
  "simple-git": "^3.22.0",      // Git integration
  "tree-sitter": "^0.21.0",     // AST parsing
  "tree-sitter-go": "^0.21.0",
  "tree-sitter-java": "^0.21.0",
  "tree-sitter-python": "^0.21.0",
  "tree-sitter-rust": "^0.21.0",
  "tree-sitter-typescript": "^0.21.0",
  "uuid": "^9.0.1",             // UUID generation
  "zod": "^3.25.76"             // Validation
}
```

---

## Adaptation Status

### ⏳ Pending Adaptations

| Component | Adaptation Needed | Complexity | Priority |
|-----------|-------------------|------------|----------|
| **MCP → VSCode Extension API** | Remove all MCP SDK code, replace with VSCode commands | High | P0 |
| **Tool Handlers → Command Handlers** | Convert MCP tool handlers to VSCode command handlers | High | P0 |
| **Visualization → WebView Panels** | Create WebView panels for all 6 visualizations | High | P0 |
| **Git Service** | Replace simple-git with VSCode Git API | Medium | P1 |
| **Tree-Sitter** | Keep as-is or use VSCode parser APIs | Low | P2 |
| **Logging** | Replace pino with VSCode OutputChannel | Low | P2 |
| **File Discovery** | Replace glob with VSCode workspace.findFiles | Medium | P1 |

### 🔧 Required New Files

| File | Purpose | Status |
|------|---------|--------|
| `src/commands/index-repository.ts` | Repository indexing command | ⏳ TODO |
| `src/commands/query-knowledge-graph.ts` | Knowledge graph query command | ⏳ TODO |
| `src/commands/explain-code.ts` | Code explanation command | ⏳ TODO |
| `src/commands/impact-analysis.ts` | Impact analysis command | ⏳ TODO |
| `src/commands/file-history.ts` | File history command | ⏳ TODO |
| `src/commands/security-scan.ts` | Security scanner command | ⏳ TODO |
| `src/commands/generate-tests.ts` | Test generator command | ⏳ TODO |
| `src/commands/dependency-graph.ts` | Dependency graph WebView | ⏳ TODO |
| `src/commands/evolution-timeline.ts` | Evolution timeline WebView | ⏳ TODO |
| `src/commands/impact-ripple.ts` | Impact ripple WebView | ⏳ TODO |
| `src/commands/semantic-clusters.ts` | Semantic clusters WebView | ⏳ TODO |
| `src/commands/architecture-analyze.ts` | Architecture analyzer WebView | ⏳ TODO |
| `src/commands/nl-query.ts` | NL query command | ⏳ TODO |
| `src/webview/graph-panel.ts` | Graph visualization WebView provider | ⏳ TODO |
| `src/webview/timeline-panel.ts` | Timeline WebView provider | ⏳ TODO |
| `src/webview/ripple-panel.ts` | Ripple WebView provider | ⏳ TODO |
| `src/webview/clusters-panel.ts` | Clusters WebView provider | ⏳ TODO |
| `src/webview/architecture-panel.ts` | Architecture WebView provider | ⏳ TODO |

---

## Implementation Plan

### Phase 1: Core Command Handlers (P0)

**Goal**: Implement all 20 command handlers

**Tasks**:
1. ✅ Create basic command structure
2. ⏳ Adapt episodic memory handler
3. ⏳ Adapt impact analysis handler
4. ⏳ Adapt query handler
5. ⏳ Create index repository command
6. ⏳ Create file history command
7. ⏳ Create security scan command
8. ⏳ Create test generator command

**Estimated Effort**: 8-12 hours

### Phase 2: WebView Visualizations (P0)

**Goal**: Create WebView panels for all 6 NexusMind visualizations

**Tasks**:
1. ⏳ Create base WebView panel provider
2. ⏳ Dependency graph WebView (D3.js integration)
3. ⏳ Evolution timeline WebView
4. ⏳ Impact ripple WebView (canvas)
5. ⏳ Semantic clusters WebView
6. ⏳ Architecture analyzer WebView
7. ⏳ NL query interface

**Estimated Effort**: 12-16 hours

### Phase 3: VSCode API Integration (P1)

**Goal**: Replace platform-specific code with VSCode APIs

**Tasks**:
1. ⏳ Replace simple-git with VSCode Git API
2. ⏳ Replace glob with workspace.findFiles
3. ⏳ Replace pino with OutputChannel
4. ⏳ Adapt file operations for VSCode workspace

**Estimated Effort**: 4-6 hours

### Phase 4: Testing & Polish (P2)

**Goal**: Test all features and fix bugs

**Tasks**:
1. ⏳ Test all 20 commands
2. ⏳ Test all 6 visualizations
3. ⏳ Fix TypeScript compilation errors
4. ⏳ Add error handling
5. ⏳ Update documentation

**Estimated Effort**: 6-8 hours

---

## File Count

- **Total Source Files Copied**: 48 TypeScript files
- **New Command Handlers Needed**: 14 files
- **WebView Providers Needed**: 5 files
- **Estimated Total Files**: ~67 files

---

## Lines of Code

- **Cursor Plugin**: ~3,500 lines (server + handlers + visualizations)
- **VSCode Plugin (current)**: ~1,500 lines
- **VSCode Plugin (target)**: ~5,000 lines (estimated)

---

## Next Steps

1. **Create all command handlers** (14 files)
2. **Create WebView panel providers** (5 files)
3. **Update extension.ts** with all command registrations
4. **Adapt MCP handlers** to VSCode commands
5. **Test compilation** and fix TypeScript errors
6. **Build extension** (requires Node.js)
7. **Test locally** in VSCode

---

## Key Differences: MCP vs VSCode Extension

| Aspect | MCP (Cursor Plugin) | VSCode Extension |
|--------|---------------------|------------------|
| **Protocol** | Model Context Protocol | VSCode Extension API |
| **Transport** | stdio (stdin/stdout) | Native API calls |
| **Tool Definition** | MCP SDK schemas | VSCode command registration |
| **UI** | Text-based responses | WebViews, panels, commands |
| **Activation** | Server process | Extension activation |
| **Configuration** | MCP settings | VSCode settings + secrets API |
| **Visualization** | ASCII/text diagrams | WebView HTML/CSS/JS |
| **Git** | simple-git library | VSCode Git API |
| **File Operations** | Node.js fs + glob | VSCode workspace API |

---

## Status Summary

- ✅ **Source Files**: 48/48 copied (100%)
- ✅ **Dependencies**: 11/11 added (100%)
- ✅ **Commands Defined**: 20/20 in package.json (100%)
- ⏳ **Command Handlers**: 6/20 implemented (30%)
- ⏳ **WebView Providers**: 0/5 implemented (0%)
- ⏳ **VSCode API Adaptation**: 0% complete
- ⏳ **Testing**: Not started

**Overall Completion**: ~40%

---

## Build Status

**Requires Node.js** to build:
```bash
cd /Users/don/Adverant/nexus-vscode-plugin
npm install
npm run build
npm run package
code --install-extension adverant.nexus-vscode-plugin-0.1.0.vsix
```

---

**Last Updated**: December 26, 2025
**Next Milestone**: Complete all 14 command handlers (Phase 1)
