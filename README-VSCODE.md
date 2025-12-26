# Nexus VSCode Plugin

**GraphRAG-Powered Code Intelligence with Enhanced RAG and Qwen2.5 72B Integration**

## 🚀 Features

- **Enhanced Search** with Qwen2.5 72B query rewriting
- **Episodic Memory** for code snippets
- **RAG Triad Evaluation** for quality scoring
- **Auto-Capture** code changes

## 📦 Installation

**Requires**:
- VSCode 1.85.0+
- Node.js 20+
- Adverant API key

Build from source:
```bash
cd nexus-vscode-plugin
npm install
npm run build
npm run package
code --install-extension adverant.nexus-vscode-plugin-0.1.0.vsix
```

## 🔧 Configuration

1. Get your API key from [api.adverant.ai](https://api.adverant.ai)
2. Run: `Nexus: Configure API Settings`
3. Enter your API key when prompted

## 📄 License

MIT License
