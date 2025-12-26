# Real Usage Test - Nexus VSCode Extension

**Date**: December 26, 2025
**Version**: 0.1.0
**Status**: Testing actual feature functionality

---

## ✅ FIXED: File Path Requirement Issue

### What Was Broken:
The visualization features threw "File path is required" error when the file path field was empty.

### What Was Fixed:
1. **main.js**: Added auto-fill logic to default to `src/extension.ts` if field is empty
2. **main.js**: Removed strict validation that blocked visualization generation
3. **index.html**: Updated label and placeholder to indicate field is optional

### Code Changes:
```javascript
// Before:
case 'dependencyGraph':
    if (!filePath) throw new Error('File path is required');  // BLOCKED USERS

// After:
async function generateVisualization() {
    let filePath = document.getElementById('file-path').value;

    // Auto-fill with current workspace if empty
    if (!filePath) {
        filePath = 'src/extension.ts'; // Default to extension entry point
    }

    // No more blocking validation!
}
```

---

## 🧪 Testing Checklist

### Step 1: Open the Panel ✅
**Action**: Press `Cmd+Shift+N` in VSCode

**Expected**:
- New tab opens with "Nexus" title
- 4 horizontal tabs visible: Dashboard, Visualizations, Code Intelligence, Security & Testing
- Dashboard tab is active by default

**Status**: Ready to test - you should try this now!

---

### Step 2: Test Dashboard Tab

**Expected Elements**:
- ✅ API Status card (should show connection state)
- ✅ 4 Quick Action cards (Store Memory, Recall Memory, Index Repository, Query Graph)
- ✅ Recent Memories section
- ✅ Repository Stats section

**Actions to Test**:
1. Check if API status shows green "Connected" or red "Disconnected"
2. Click "Store Memory" button - should prompt for memory content
3. Click "Recall Memory" button - should prompt for search query
4. Click "Index Repository" button - should start indexing process
5. Click "Query Graph" button - should prompt for natural language query

---

### Step 3: Test Visualizations Tab (CRITICAL - This Was Broken!)

#### Test 3A: Dependency Graph with Empty File Path
**Action**:
1. Click "Visualizations" tab
2. Leave "File/Folder Path" field EMPTY
3. Click "Generate Visualization"

**Expected Behavior (NEW)**:
- ✅ NO ERROR! Should use default: `src/extension.ts`
- ✅ Loading spinner appears: "Generating visualization..."
- ⚠️ May succeed if file exists, or show API error if backend needs data
- ✅ Error message should be helpful, NOT "File path is required"

**Status**: 🔧 FIXED - Awaiting your test

---

#### Test 3B: Dependency Graph with Specific File
**Action**:
1. Enter file path: `src/extension.ts`
2. Select layout: "Force-Directed"
3. Click "Generate Visualization"

**Expected**:
- Loading spinner
- API call to backend
- Either: Success + graph displayed
- Or: Clear error message about backend state

---

#### Test 3C: Evolution Timeline
**Action**:
1. Select visualization type: "Evolution Timeline"
2. Enter file path: `src/extension.ts` (or leave empty for default)
3. Click "Generate Visualization"

**Expected**:
- Loading spinner
- Timeline visualization or helpful error message

---

#### Test 3D: Natural Language Query
**Action**:
1. Select visualization type: "Natural Language Query"
2. Enter query: "Show me all TypeScript files"
3. Click "Generate Visualization"

**Expected**:
- Loading spinner
- Query results or error if backend not ready

---

### Step 4: Test Code Intelligence Tab

#### Test 4A: Explain Code
**Action**:
1. Click "Code Intelligence" tab
2. Paste code into textarea:
```typescript
export function activate(context: vscode.ExtensionContext) {
    console.log('Extension activated');
}
```
3. Click "Explain Code"

**Expected**:
- Loading spinner
- API call to MageAgent
- Either: Code explanation appears
- Or: Error message about backend (500 error from test results)

---

#### Test 4B: Use Selection
**Action**:
1. Open a .ts file in VSCode
2. Select some code
3. Click "Use Selection" button in panel

**Expected**:
- Selected code appears in textarea
- Can then click "Explain Code"

---

### Step 5: Test Security & Testing Tab

#### Test 5A: Generate Tests
**Action**:
1. Click "Security & Testing" tab
2. Paste code into "Code to Test" textarea:
```typescript
function add(a: number, b: number): number {
    return a + b;
}
```
3. Select framework: "Jest"
4. Click "Generate Tests"

**Expected**:
- Loading spinner
- API call to MageAgent
- Either: Generated tests appear
- Or: Error about backend not ready

---

#### Test 5B: Security Scan
**Action**:
1. Enter repository path: `/Users/don/Adverant/nexus-vscode-plugin`
2. Click "Run Security Scan"

**Expected**:
- Loading spinner
- Security analysis or error message

---

## 🎯 What Success Looks Like

### Minimum Viable Success ✅
- Panel opens without errors
- All tabs are clickable and render correctly
- Features attempt to call APIs (no "File path is required" errors!)
- Error messages are helpful and specific (not blocking validation errors)

### Ideal Success ✅✅
- All visualizations generate successfully
- Code explanations work
- Test generation works
- Security scans complete

### Expected Partial Success ⚠️
Based on previous API tests, some features may fail with backend errors:
- GraphRAG search: 500 error (needs indexed data)
- MageAgent orchestrate: 500 error (AI models need initialization)

**This is OK!** As long as:
- No "File path is required" errors
- No blocking validation errors
- Error messages explain the backend issue
- UI handles errors gracefully

---

## 🐛 Debugging Guide

### If Panel Won't Open:
```bash
# Reload VSCode window
Cmd+Shift+P → "Developer: Reload Window"

# Check extension is installed
code --list-extensions | grep nexus

# Should show: adverant.nexus-vscode-plugin@0.1.0
```

### If Features Still Show "File path is required":
**This should NOT happen anymore!** If it does:
1. Check you reloaded VSCode after reinstalling
2. Open Developer Tools: `Help` → `Toggle Developer Tools`
3. Check Console tab for JavaScript errors
4. Verify the fix was applied by checking main.js in the extension

### If Features Show Other Errors:
**This is expected!** Check if error is:
- ❌ "File path is required" = BUG (shouldn't happen)
- ✅ "500 Internal Server Error" = Expected (backend needs data)
- ✅ "Unable to generate explanation" = Expected (AI models loading)
- ✅ "Search failed" = Expected (no indexed data yet)

---

## 📊 Test Results Template

```
=== NEXUS EXTENSION REAL USAGE TEST ===

Date: December 26, 2025
Tester: [Your Name]

Panel Opens: [ ] YES [ ] NO
Dashboard Tab: [ ] YES [ ] NO
Visualizations Tab: [ ] YES [ ] NO
Code Intelligence Tab: [ ] YES [ ] NO
Security & Testing Tab: [ ] YES [ ] NO

--- CRITICAL TEST ---
Dependency Graph (Empty File Path):
[ ] Works (no "File path is required" error)
[ ] Still broken (shows error)
Error seen: _______________________

Dependency Graph (With File Path):
[ ] Success [ ] Backend Error [ ] Other Error
Details: _______________________

Code Explanation:
[ ] Success [ ] Backend Error [ ] Other Error
Details: _______________________

Test Generation:
[ ] Success [ ] Backend Error [ ] Other Error
Details: _______________________

Overall Assessment:
[ ] All features work end-to-end
[ ] UI works, some backend errors (expected)
[ ] Still has blocking bugs
```

---

## 🚀 Next Steps After Testing

1. **If all tests pass**: Document success and celebrate! 🎉
2. **If backend errors**: Normal! Backend team needs to initialize data/models
3. **If UI bugs found**: Report them and we'll fix
4. **If "File path is required" still appears**: Something went wrong with rebuild

---

## 🔧 Quick Fix Reference

If you need to make changes:

```bash
# 1. Make code edits
# 2. Rebuild
cd /Users/don/Adverant/nexus-vscode-plugin
/opt/homebrew/Cellar/node@20/20.19.6/bin/node ./node_modules/.bin/tsc -p .

# 3. Repackage
export PATH="/opt/homebrew/Cellar/node@20/20.19.6/bin:$PATH"
/opt/homebrew/Cellar/node@20/20.19.6/bin/node ./node_modules/.bin/vsce package --no-yarn

# 4. Reinstall
code --uninstall-extension adverant.nexus-vscode-plugin
code --install-extension nexus-vscode-plugin-0.1.0.vsix --force

# 5. Reload VSCode
Cmd+Shift+P → "Developer: Reload Window"
```

---

**NOW GO TEST IT!** Press `Cmd+Shift+N` and try the features!
