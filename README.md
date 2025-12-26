<div align="center">
  <img src="docs/images/adverant-logo-icon.png" alt="Adverant Logo" width="240"/>

  # Nexus VSCode Plugin

  **GraphRAG-Powered Code Intelligence for Visual Studio Code**

  [![VSCode Marketplace](https://img.shields.io/badge/VSCode-Marketplace-blue)](https://marketplace.visualstudio.com/items?itemName=adverant.nexus-vscode-plugin)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

  **Version:** 0.1.0 | **Last Updated:** December 26, 2025

  [Why Nexus?](#why-nexus) • [NexusMind](#-nexusmind-visualization) • [Features](#features) • [Quick Start](#quick-start) • [Commands](#commands)
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
| Static diagrams | **NexusMind** — interactive, AI-powered code visualization |

### The Knowledge Gap Problem

Every codebase has tribal knowledge trapped in developers' heads:
- *"Don't touch that file, it breaks everything"*
- *"We tried that approach in 2022, here's why it failed"*
- *"This workaround exists because of X edge case"*

**Nexus captures this.** Every query, every explanation, every impact analysis builds your codebase's institutional memory. New team members get context that would take months to acquire.

---

## 🧠 NexusMind Visualization

> Transform your codebase into an explorable knowledge graph

NexusMind is an interactive, AI-driven code visualization system that goes beyond traditional diagrams. It leverages GraphRAG infrastructure, multi-model AI orchestration, and temporal code analysis to create living, breathing visualizations.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Visual Studio Code                                  │
├─────────────────────────────────────────────────────────────────────────┤
│   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│   │  NexusMind Panel │  │   Graph Viewer   │  │   Sidebar Views      │  │
│   │  (WebView)       │  │  (Force Layout)  │  │   (Tree Data)        │  │
│   └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘  │
│            └─────────────────────┼───────────────────────┘              │
│                                  │                                      │
│                      ┌───────────▼───────────┐                          │
│                      │  Extension Commands   │                          │
│                      │  (nexus.* commands)   │                          │
│                      └───────────┬───────────┘                          │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
┌─────────▼─────────┐  ┌───────────▼───────────┐  ┌────────▼────────┐
│   GraphRAG API    │  │    MageAgent API      │  │   Git Service   │
│  (Knowledge Graph)│  │  (Multi-Model AI)     │  │   (Temporal)    │
│                   │  │                       │  │                 │
│ • Entity Storage  │  │ • Orchestration       │  │ • File History  │
│ • Vector Search   │  │ • Competition Mode    │  │ • Blame Data    │
│ • Relationships   │  │ • Collaboration Mode  │  │ • Diff Analysis │
└───────────────────┘  └───────────────────────┘  └─────────────────┘
```

### NexusMind Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `NexusMind: Dependency Graph` | Interactive dependency visualization | Understand code structure |
| `NexusMind: Evolution Timeline` | Code history over time | Track how code evolved |
| `NexusMind: Impact Ripple` | Change propagation visualization | Pre-change risk assessment |
| `NexusMind: Semantic Clusters` | AI-powered code grouping | Find related code |
| `NexusMind: Analyze Architecture` | Code smell detection | Improve architecture |
| `NexusMind: Natural Language Query` | Natural language graph queries | Explore visually |

---

### 📊 Dependency Graph

Build interactive dependency graphs with multiple layout algorithms.

**Command**: `NexusMind: Dependency Graph`

**Layout Options:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   FORCE-DIRECTED              HIERARCHICAL            RADIAL            │
│                                                                         │
│       ○───○                      ○                       ○              │
│      /│   │\                    /│\                    / │ \            │
│     ○ │   │ ○                  ○ ○ ○                  ○  ○  ○           │
│      \│   │/                  /│   │\                 │  │  │           │
│       ○───○                  ○ ○   ○ ○               ○  ○  ○            │
│                                                                         │
│   Best for:                Best for:             Best for:              │
│   Complex dependencies     Module hierarchy      Central modules        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Node Types**: Files, functions, classes, modules
- **Edge Types**: Imports, calls, extends, implements
- **Metrics per Node**: Complexity, change frequency, impact score
- **Filtering**: Include/exclude test files, external deps

---

### 📈 Evolution Timeline

Visualize how code entities evolve over time with AI-generated insights.

**Command**: `NexusMind: Evolution Timeline`

**Timeline Visualization:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        server.ts Evolution                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Commits  ████░░██████░░░░████████░░░░░░██████████████████░░░░████      │
│           Oct       Nov       Dec       Jan       Feb       Mar         │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Oct 15   ● Initial server implementation                               │
│           │ Author: alice@team.com                                      │
│           │ +245 lines, -0 lines                                        │
│           │                                                             │
│  Nov 3    ● Added authentication middleware                             │
│           │ Author: bob@team.com                                        │
│           │ +89 lines, -12 lines                                        │
│           │ Impact: HIGH - 8 dependent files                            │
│                                                                         │
│  Dec 20   ● Refactored to use dependency injection                      │
│           │ Author: alice@team.com                                      │
│           │ +156 lines, -98 lines                                       │
│           │ AI Summary: "Major architectural change enabling            │
│           │              better testability and modularity"             │
│                                                                         │
│  Feb 1    ● Added NexusMind visualization support                       │
│           │ Author: developer@team.com                                  │
│           │ +162 lines, -2 lines                                        │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  STATISTICS                                                             │
│  • Total Commits: 47          • Most Active: alice (28 commits)         │
│  • Lines Changed: +1,234 -567 • Churn Rate: 2.3 changes/week            │
│  • Contributors: 5            • Avg Complexity: Growing (+15%)          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 🌊 Impact Ripple

Visualize change propagation as concentric rings.

**Command**: `NexusMind: Impact Ripple`

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  Impact Analysis: updateUser()                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                            ┌─────┐                                      │
│                        ┌───│ Lvl3│───┐     Depth 3 (6 files)           │
│                    ┌───│   └─────┘   │───┐                             │
│                ┌───│   │  Lvl 2      │   │───┐  Depth 2 (12 files)     │
│            ┌───│   │   │   ┌───┐    │   │   │───┐                      │
│        ┌───│   │   │   └───│Lvl│────┘   │   │   │───┐                  │
│    ┌───│   │   │       ┌──│ 1 │──┐     │   │   │   │───┐              │
│  ┌─│   │   │   └───────│  └───┘  │─────┘   │   │   │───│─┐            │
│  │ │   │   └───────────│    ●    │─────────┘   │   │   │ │            │
│  │ │   └───────────────│updateUser│─────────────┘   │   │ │            │
│  │ └───────────────────│  (core) │─────────────────┘   │ │            │
│  └─────────────────────│         │─────────────────────┘ │            │
│                        └─────────┘                                      │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Impact Summary:                                                        │
│  • Direct callers: 4            • Total affected files: 23              │
│  • Indirect impact: 19 files    • Max depth: 3 levels                   │
│  • Risk level: HIGH             • Test coverage: 67%                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Features

### Core Intelligence

- **Episodic Memory**: Store and recall code context with semantic search
- **Knowledge Graph Queries**: Natural language search over your codebase
- **Code Explanation**: Understand *why* code was written, not just *what* it does
- **Impact Analysis**: Assess ripple effects before making changes
- **File History**: Visualize code evolution with AI-generated insights

### NexusMind Visualizations

- **Dependency Graph**: 4 layout algorithms (force, hierarchical, radial, organic)
- **Evolution Timeline**: Temporal analysis with AI insights
- **Impact Ripple**: Concentric ring visualization of change propagation
- **Semantic Clusters**: AI-powered code grouping (KMeans, DBSCAN, Hierarchical)
- **Architecture Analysis**: Code smell detection (6 types of issues)
- **Natural Language Queries**: Ask questions, get visual answers

### AI Features

- **Multi-Model Orchestration**: Smart routing to best AI model
- **Competition Mode**: Multiple models compete on same task
- **Collaboration Mode**: Multiple agents work together
- **Test Generation**: AI-powered test creation (6 frameworks)
- **Security Scanning**: Vulnerability detection (8 ecosystems)

---

## Quick Start

### Installation

#### From VSCode Marketplace (Coming Soon)

1. Open VSCode
2. Go to Extensions (`Cmd+Shift+X` or `Ctrl+Shift+X`)
3. Search for "Nexus"
4. Click Install

#### Build from Source

```bash
git clone https://github.com/adverant/nexus-vscode-plugin.git
cd nexus-vscode-plugin
npm install
npm run build
npm run package
code --install-extension adverant.nexus-vscode-plugin-0.1.0.vsix
```

### Configuration

1. Get API key from [api.adverant.ai](https://api.adverant.ai)
2. Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
3. Run: `Nexus: Configure API Settings`
4. Enter your API key
5. Reload VSCode

---

## Commands

### Core Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| `Nexus: Store Memory` | Store selected code as memory | - |
| `Nexus: Recall Memory` | Search memories semantically | - |
| `Nexus: Index Repository` | Index entire repository | - |
| `Nexus: Query Knowledge Graph` | Natural language code search | - |
| `Nexus: Explain Code` | Explain code with history | - |
| `Nexus: Analyze Impact` | Change impact analysis | - |
| `Nexus: Show File History` | File evolution timeline | - |
| `Nexus: Security Scan` | Vulnerability scanning | - |
| `Nexus: Generate Tests` | AI test generation | - |
| `Nexus: Configure API Settings` | Update API key | - |

### NexusMind Visualization Commands

| Command | Description |
|---------|-------------|
| `NexusMind: Dependency Graph` | Interactive dependency visualization |
| `NexusMind: Evolution Timeline` | Code history over time |
| `NexusMind: Impact Ripple` | Change propagation visualization |
| `NexusMind: Semantic Clusters` | AI-powered code grouping |
| `NexusMind: Analyze Architecture` | Code smell detection |
| `NexusMind: Natural Language Query` | Ask questions visually |

---

## Settings

Configure Nexus in VSCode Settings (`Cmd+,` or `Ctrl+,`):

```json
{
  "nexus.apiEndpoint": "https://api.adverant.ai",
  "nexus.mageAgentEndpoint": "https://api.adverant.ai",
  "nexus.autoIndex": false,
  "nexus.maxFileSize": 1048576
}
```

---

## Documentation

- [Installation Guide](docs/installation.md)
- [Command Reference](docs/commands.md)
- [NexusMind Guide](docs/nexusmind.md)
- [API Reference](docs/api.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Changelog](CHANGELOG.md)

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
npm run test:run
```

### Debugging

1. Open repository in VSCode
2. Press `F5` to launch Extension Development Host
3. Test extension in new window
4. View logs in Debug Console

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

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
- [Tree-sitter](https://tree-sitter.github.io/)
- [simple-git](https://github.com/steveukx/git-js)

---

<div align="center">
  Made with ❤️ by <a href="https://adverant.ai">Adverant</a>
</div>
