#!/bin/bash
# Build and Install Nexus VSCode Extension

set -e  # Exit on error

echo "🚀 Building Nexus VSCode Extension..."
echo ""

# Step 1: Clean old build
echo "📦 Step 1: Cleaning old build..."
rm -rf dist/webview 2>/dev/null || true

# Step 2: Compile TypeScript
echo "🔨 Step 2: Compiling TypeScript..."
npm run compile

# Step 3: Check compilation results
echo "✅ Step 3: Checking compilation..."
if [ ! -f "dist/extension.js" ]; then
    echo "❌ Error: extension.js not found in dist/"
    exit 1
fi

if [ ! -d "dist/webview" ]; then
    echo "❌ Error: webview directory not compiled"
    exit 1
fi

echo "✅ Compilation successful!"
ls -la dist/webview/

# Step 4: Package extension
echo "📦 Step 4: Packaging extension..."
rm -f nexus-vscode-plugin-*.vsix 2>/dev/null || true
vsce package --no-yarn

# Step 5: Get VSIX filename
VSIX_FILE=$(ls nexus-vscode-plugin-*.vsix 2>/dev/null | head -1)

if [ -z "$VSIX_FILE" ]; then
    echo "❌ Error: VSIX file not created"
    exit 1
fi

echo "✅ Package created: $VSIX_FILE"

# Step 6: Install extension
echo "🔧 Step 5: Installing extension in VSCode..."
code --install-extension "$VSIX_FILE" --force

echo ""
echo "✅ ✅ ✅ SUCCESS! ✅ ✅ ✅"
echo ""
echo "Next steps:"
echo "1. Reload VSCode window (Cmd+Shift+P → 'Reload Window')"
echo "2. Open Nexus Panel:"
echo "   - Press Cmd+Shift+N"
echo "   - Or: Cmd+Shift+P → 'Nexus: Open Panel'"
echo "   - Or: Click any visualization in the NEXUS sidebar"
echo ""
echo "🎉 Enjoy your world-class Nexus extension!"
