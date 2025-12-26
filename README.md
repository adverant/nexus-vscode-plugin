<div align="center">
  <img src="docs/images/adverant-logo-final.svg" alt="Adverant Logo" width="240"/>

  # Nexus VSCode Plugin

  **GraphRAG-Powered Code Intelligence for Visual Studio Code**

  [![VSCode Marketplace](https://img.shields.io/badge/VSCode-Marketplace-blue)](https://marketplace.visualstudio.com/items?itemName=adverant.nexus-vscode-plugin)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
  [![Qwen2.5](https://img.shields.io/badge/Qwen2.5-72B-red)](https://huggingface.co/Qwen/Qwen2.5-72B)

  **Version:** 0.1.0 | **Last Updated:** December 26, 2025

  [Why Nexus?](#why-nexus) • [Features](#features) • [Quick Start](#quick-start) • [Enhanced RAG](#-enhanced-rag-with-qwen25-72b) • [Documentation](#documentation)
</div>

---

## Why Nexus?

Most tools tell you **who** changed code. Nexus tells you **why**.

| Traditional Tools | Nexus VSCode Plugin |
|-------------------|---------------------|
| Shows git blame (who, when) | Connects changes to **intent** via knowledge graph |
| File history as a timeline | **Episodic memory** — understands evolution patterns |
| Search by filename/text | **Semantic search** — understands what code *does* |
| No prediction | **Impact analysis** — see ripple effects *before* you change |
| Limited AI context | **Enhanced RAG** — Qwen2.5 72B query enhancement |

### The Knowledge Gap Problem

Every codebase has tribal knowledge trapped in developers' heads:
- *"Don't touch that file, it breaks everything"*
- *"We tried that approach in 2022, here's why it failed"*
- *"This workaround exists because of X edge case"*

**Nexus captures this.** Every query, every explanation, every impact analysis builds your codebase's institutional memory. New team members get context that would take months to acquire.

---

## Features

### 🧠 Enhanced RAG with Qwen2.5 72B

The VSCode plugin integrates **Qwen2.5 72B** (Opus-level local LLM) for advanced query enhancement:

- **Query Enhancement**: Rewrites vague queries for better semantic search (30-50% improvement)
- **HyDE (Hypothetical Document Embeddings)**: Generates hypothetical code, searches for similar real code (15-25% improvement)
- **Self-Correction Loop**: Iteratively improves search quality until threshold is met
- **RAG Triad Evaluation**: Scores searches using Context Relevance, Groundedness, Answer Relevance

**Example:**

```
User Query: "how does auth work?"

Qwen Enhanced Query:
"Explain JWT token-based authentication implementation with Express.js
including bcrypt password hashing and validation"

Result: 73% relevance score (vs 42% without enhancement)
```

### 💾 Episodic Memory

Store and recall code snippets with semantic search powered by GraphRAG:

```bash
# Command Palette: "Nexus: Store Memory"
- Select code snippet
- Add tags: authentication, express, typescript
- Stored with semantic embeddings

# Command Palette: "Nexus: Recall Memory"
- Search: "show me user registration code"
- Results ranked by semantic relevance
```

### 🔍 Enhanced Search

Multi-stage search pipeline with Qwen2.5 72B integration:

1. **Query Analysis**: Complexity scoring and routing decisions
2. **Query Enhancement**: LLM rewriting for better semantic matching
3. **Hybrid Search**: PostgreSQL + Qdrant + Neo4j knowledge graph
4. **Self-Correction**: Iterative refinement until quality threshold met
5. **RAG Triad Evaluation**: Quality scoring and validation

### 📊 Tree Views

- **Memories View**: Browse stored code snippets, search semantically
- **NexusMind View**: (Coming Soon) Interactive code visualization

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Visual Studio Code                                         │
│  - Nexus Extension (TypeScript)                             │
│  - Command Palette Commands                                 │
│  - Tree View Providers                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  api.adverant.ai (GraphRAG API)                             │
│  - POST /graphrag/api/memory (store)                        │
│  - POST /graphrag/api/memory/recall (search)                │
│  - GET /graphrag/api/memories (list)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  nexus-graphrag-enhanced (Port 9051)                        │
│  - Query Enhancement (LLM rewriting)                        │
│  - HyDE (Hypothetical Document Embeddings)                  │
│  - Self-Correction (iterative refinement)                   │
│  - RAG Triad Evaluation (quality scoring)                   │
│  - Adaptive Routing (cost optimization)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  nexus-graphrag (Port 8090)                                 │
│  - Hybrid Search (PostgreSQL + Qdrant + Neo4j)              │
│  - Voyage AI Embeddings (voyage-3, 1024 dims)               │
│  - Knowledge Graph (Neo4j relationships)                    │
│  - Vector Search (Qdrant semantic search)                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Qwen2.5 72B (Local Ollama - localhost:11434)               │
│  - Model Size: 47 GB                                        │
│  - Quality: Opus-level code generation                      │
│  - Context: 128K tokens                                     │
│  - Used for: Query enhancement, HyDE generation             │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- **Visual Studio Code** 1.85.0 or higher
- **Node.js** 20+ (for building from source)
- **Adverant API Key** ([Get yours at api.adverant.ai](https://api.adverant.ai))
- **Ollama** (optional, for Qwen2.5 72B local inference)

### Installation

#### From VSCode Marketplace (Coming Soon)

```bash
# Search for "Nexus" in VSCode Extensions
# Or: code --install-extension adverant.nexus-vscode-plugin
```

#### Build from Source

```bash
# Clone repository
git clone https://github.com/adverant/nexus-vscode-plugin.git
cd nexus-vscode-plugin

# Install dependencies
npm install

# Build extension
npm run build

# Package extension
npm run package

# Install locally
code --install-extension adverant.nexus-vscode-plugin-0.1.0.vsix
```

### Configuration

1. **Open Command Palette**: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
2. **Run**: `Nexus: Configure API Settings`
3. **Enter your API key**: `brain_...`
4. **Reload VSCode**

#### Settings (Optional)

Open VSCode Settings (`Cmd+,`) and search for "Nexus":

```json
{
  "nexus.apiEndpoint": "https://api.adverant.ai",
  "nexus.enhancedEndpoint": "http://localhost:9051",
  "nexus.ollamaEndpoint": "http://localhost:11434",
  "nexus.companyId": "adverant",
  "nexus.appId": "vscode-nexus",
  "nexus.enableEnhancedRAG": true,
  "nexus.enableQwen": true,
  "nexus.enableAutoCapture": true
}
```

### Ollama Setup (Optional)

For **local Qwen2.5 72B** inference (query enhancement without API costs):

```bash
# Install Ollama
brew install ollama  # macOS
# or download from: https://ollama.ai

# Pull Qwen2.5 72B model
ollama pull qwen2.5:72b

# Verify model is running
ollama list
```

---

## Commands

| Command | Description | Keyboard Shortcut |
|---------|-------------|-------------------|
| `Nexus: Store Memory` | Store selected code as memory | - |
| `Nexus: Recall Memory` | Search memories semantically | - |
| `Nexus: Enhanced Search` | Full enhanced RAG search | - |
| `Nexus: Analyze Query` | Query complexity analysis | - |
| `Nexus: Show NexusMind` | Visualization (coming soon) | - |
| `Nexus: Configure API Settings` | Update API key | - |

---

## Usage Examples

### Store Code Memory

1. Select code snippet in editor
2. `Cmd+Shift+P` → `Nexus: Store Memory`
3. Enter tags (comma-separated): `authentication, express, typescript`
4. Memory stored with semantic embeddings

### Recall Memory

1. `Cmd+Shift+P` → `Nexus: Recall Memory`
2. Enter query: `show me user registration code`
3. View results ranked by semantic relevance
4. Click result to view full memory

### Enhanced Search

1. `Cmd+Shift+P` → `Nexus: Enhanced Search`
2. Enter query: `how to implement authentication?`
3. Qwen2.5 72B enhances query
4. GraphRAG performs hybrid search
5. Results evaluated with RAG Triad
6. Self-correction if quality < threshold

### Query Analysis

1. `Cmd+Shift+P` → `Nexus: Analyze Query`
2. Enter query: `refactor this component`
3. View:
   - Complexity score
   - Routing decision (direct_llm, keyword_only, semantic_only, full_pipeline)
   - Estimated cost
   - Recommended approach

---

## 🚀 Enhanced RAG with Qwen2.5 72B

### Query Enhancement (30-50% Improvement)

**Before**: "how does auth work?"
**After (Qwen Enhanced)**: "Explain JWT token-based authentication implementation with Express.js including bcrypt password hashing and validation"
**Result**: Significantly more relevant code examples retrieved

### HyDE (15-25% Improvement)

1. User query: "How to implement user registration?"
2. Qwen generates hypothetical registration code
3. GraphRAG searches for code similar to hypothetical
4. Finds actual implementations with higher accuracy

### Self-Correction

1. Initial search quality: 0.65 (below threshold)
2. Qwen analyzes quality issues
3. Suggests query refinement
4. Re-searches with improved query
5. Final quality: 0.88 (above threshold)

### Performance Metrics

| Metric | No Enhancement | With Qwen Enhancement |
|--------|----------------|----------------------|
| Latency | 400-600ms | 800-1200ms (no correction) |
|         |            | 1500-2500ms (with correction) |
| Quality | 0.42-0.65 | 0.65-0.88 |
| Relevance | Medium | High |
| Cost | API credits | Free (local Ollama) |

---

## Documentation

- [Installation Guide](docs/installation.md)
- [API Reference](docs/api.md)
- [GraphRAG Commands](docs/graphrag-commands.md)
- [Enhanced RAG Guide](docs/enhanced-rag.md)
- [Migration from Cursor Plugin](VSCODE_MIGRATION.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Changelog](CHANGELOG.md)

---

## Pricing

Nexus uses the Adverant GraphRAG API:

| Tier | Price | Memories | Enhanced Search | Support |
|------|-------|----------|----------------|---------|
| **Free** | $0/mo | 100 | 50/day | Community |
| **Pro** | $29/mo | 10,000 | Unlimited | Email |
| **Team** | $99/mo | 100,000 | Unlimited | Priority |
| **Enterprise** | Custom | Unlimited | Unlimited | Dedicated |

**Note**: Local Qwen2.5 72B inference is **free** (requires Ollama installation and 47 GB disk space).

---

## Development

### Building

```bash
npm install
npm run build
```

### Testing

```bash
npm test
npm run test:watch
```

### Debugging

1. Open repository in VSCode
2. Press `F5` to launch Extension Development Host
3. Test extension in new window
4. View logs in Debug Console

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Project Structure

```
nexus-vscode-plugin/
├── src/
│   ├── extension.ts           # Extension entry point
│   ├── clients/               # API clients
│   │   ├── graphrag-client.ts
│   │   ├── graphrag-enhanced-client.ts
│   │   └── ollama-client.ts
│   ├── commands/              # Command handlers
│   │   ├── store-memory.ts
│   │   ├── recall-memory.ts
│   │   ├── enhanced-search.ts
│   │   ├── analyze-query.ts
│   │   ├── show-nexusmind.ts
│   │   └── configure.ts
│   └── views/                 # Tree view providers
│       ├── memories-view-provider.ts
│       └── nexusmind-view-provider.ts
├── package.json               # Extension manifest
├── tsconfig.json              # TypeScript config
└── README.md                  # This file
```

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/adverant/nexus-vscode-plugin/issues)
- **Email**: support@adverant.ai
- **Documentation**: [docs.adverant.ai](https://docs.adverant.ai)

---

## Acknowledgments

Built with:
- [VSCode Extension API](https://code.visualstudio.com/api)
- [GraphRAG](https://github.com/microsoft/graphrag)
- [Qwen2.5 72B](https://huggingface.co/Qwen/Qwen2.5-72B)
- [Ollama](https://ollama.ai)
- [Voyage AI Embeddings](https://www.voyageai.com/)

---

<div align="center">
  Made with ❤️ by <a href="https://adverant.ai">Adverant</a>
</div>
