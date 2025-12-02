<div align="center">
  <img src="docs/images/adverant-logo-final.svg" alt="Adverant Logo" width="240"/>

  # Nexus Cursor Plugin

  **GraphRAG-Powered Code Intelligence for Cursor IDE**

  [![npm version](https://img.shields.io/npm/v/@adverant/nexus-cursor-plugin)](https://www.npmjs.com/package/@adverant/nexus-cursor-plugin)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
  [![Tests](https://img.shields.io/badge/Tests-143%20passing-brightgreen)](.)
  [![MCP](https://img.shields.io/badge/MCP-1.0-purple)](https://modelcontextprotocol.io/)

  [Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Contributing](#contributing)
</div>

---

## Overview

Nexus Cursor Plugin brings enterprise-grade code intelligence to Cursor IDE through the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). Powered by [Adverant's](https://adverant.ai) GraphRAG knowledge graph, it provides deep codebase understanding, historical context from git history, and multi-model AI analysis.

## Features

### 🧠 **Episodic Memory**
Understand *WHY* code was written by analyzing git commit history and connecting changes to their original intent.

### 🔍 **Impact Analysis**
See ripple effects before making changes. Know exactly which files, functions, and tests will be affected.

### 💬 **Natural Language Queries**
Ask questions about your codebase in plain English and get accurate, context-aware answers.

### 🤖 **Multi-Model AI**
Powered by MageAgent with access to 30+ LLM models for optimal response quality.

### 🛡️ **Security Scanning**
Real-time vulnerability detection and security best practices analysis.

### 📊 **Multi-Language Support**
Full support for TypeScript, JavaScript, Python, Go, Rust, and Java with tree-sitter parsing.

## Quick Start

### 1. Get Your API Key

1. Sign up at [adverant.ai](https://adverant.ai)
2. Go to Settings → API Keys
3. Create a new API key for "Cursor IDE"

### 2. Install & Configure

Add to your `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "nexus": {
      "command": "npx",
      "args": ["-y", "@adverant/nexus-cursor-plugin"],
      "env": {
        "NEXUS_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### 3. Start Using

In Cursor chat, use `@nexus` to access tools:

```
@nexus explain this code
@nexus what calls this function?
@nexus find authentication code
@nexus why was this changed?
@nexus analyze impact of changing UserService
```

## Available Tools

| Tool | Description |
|------|-------------|
| `nexus_health` | Check connection to Nexus backend services |
| `nexus_index_repository` | Index the current repository for code intelligence |
| `nexus_query` | Natural language codebase queries |
| `nexus_explain_code` | Explain code with historical context |
| `nexus_impact_analysis` | Analyze change ripple effects |
| `nexus_file_history` | Get file evolution timeline |

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `NEXUS_API_KEY` | Your Adverant API key | Required |
| `NEXUS_ENDPOINT` | API endpoint | `https://api.adverant.ai` |
| `LOG_LEVEL` | Logging level | `info` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Cursor IDE                              │
└─────────────────────────┬───────────────────────────────────┘
                          │ MCP Protocol (stdio)
┌─────────────────────────▼───────────────────────────────────┐
│              Nexus Cursor Plugin (MCP Server)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Tree-sitter  │  │    Git       │  │   GraphRAG   │       │
│  │   Parsers    │  │   Service    │  │    Client    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS + WebSocket
┌─────────────────────────▼───────────────────────────────────┐
│                 Adverant Nexus Platform                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ GraphRAG │  │MageAgent │  │  Neo4j   │  │  Qdrant  │    │
│  │ Service  │  │ Service  │  │  Graph   │  │ Vectors  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## BYOK (Bring Your Own Keys)

Configure external API keys at [adverant.ai/settings/external-keys](https://adverant.ai/settings/external-keys):

- **OpenRouter** - Required for MageAgent multi-model orchestration
- **Anthropic** - Optional, direct Claude access
- **OpenAI** - Optional, direct GPT access

## Development

### Prerequisites

- Node.js 20+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/adverant/nexus-cursor-plugin.git
cd nexus-cursor-plugin

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run in development mode
npm run dev
```

### Project Structure

```
nexus-cursor-plugin/
├── src/
│   ├── server.ts              # MCP server implementation
│   ├── types.ts               # TypeScript type definitions
│   ├── indexer/               # Repository indexing
│   │   └── repository-indexer.ts
│   ├── parsers/               # Language parsers
│   │   ├── tree-sitter-service.ts
│   │   └── language-configs.ts
│   ├── git/                   # Git integration
│   │   └── git-service.ts
│   ├── graphrag/              # GraphRAG client
│   │   └── graphrag-client.ts
│   └── __tests__/             # Test suites
├── examples/                  # Usage examples
├── docs/                      # Documentation
└── README.md
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/__tests__/unit/server.test.ts
```

## Documentation

- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [API Reference](https://docs.adverant.ai/cursor-plugin/api)
- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Changelog](CHANGELOG.md)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Steps

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and add tests
4. Run linter and tests (`npm run lint && npm test`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to your fork (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Support

- **Documentation**: [docs.adverant.ai](https://docs.adverant.ai)
- **Issues**: [GitHub Issues](https://github.com/adverant/nexus-cursor-plugin/issues)
- **Email**: support@adverant.ai
- **Discord**: [Join our community](https://discord.gg/adverant)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <strong>Built with ❤️ by <a href="https://adverant.ai">Adverant</a></strong>

  <br/><br/>

  <a href="https://adverant.ai">Website</a> •
  <a href="https://docs.adverant.ai">Docs</a> •
  <a href="https://twitter.com/adverant">Twitter</a> •
  <a href="https://discord.gg/adverant">Discord</a>
</div>
