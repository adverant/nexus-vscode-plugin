# Nexus VSCode Plugin - Testing Guide

**Date**: December 26, 2025
**Status**: Ready for Testing (requires Node.js installation)

---

## Prerequisites

### 1. Install Node.js

```bash
# Install Node.js 20+ via Homebrew
brew install node@20

# OR download from https://nodejs.org/
```

### 2. Build the Extension

```bash
cd /Users/don/Adverant/nexus-vscode-plugin

# Install dependencies
npm install

# Build TypeScript
npm run build

# Package extension
npm run package

# Install in VSCode
code --install-extension adverant.nexus-vscode-plugin-0.1.0.vsix
```

---

## Configuration

### API Key Setup

1. Open VSCode Command Palette (`Cmd+Shift+P`)
2. Run: `Nexus: Configure API Settings`
3. Enter API key: `brain_y6NFzv-Gx3UITfJgG0tWwd6XgeZbOCxAKNJ_Kjo2JjT8PAipLWGIPH-xRDQHyZAv`
4. Reload VSCode

### Settings Verification

Open VSCode Settings (`Cmd+,`) and verify:

```json
{
  "nexus.apiEndpoint": "https://api.adverant.ai",
  "nexus.mageAgentEndpoint": "https://api.adverant.ai",
  "nexus.autoIndex": false,
  "nexus.maxFileSize": 1048576
}
```

---

## Test Plan

### Phase 1: Core Commands (7 tests)

#### Test 1.1: Store Memory
**Command**: `Nexus: Store Memory`

**Steps**:
1. Open a code file
2. Select a code snippet
3. Run `Nexus: Store Memory`
4. Add tags when prompted (e.g., `authentication, express`)
5. Verify success message

**Expected Result**:
- ✅ Memory stored successfully
- ✅ Success message shows memory ID
- ✅ API call to `POST /graphrag/api/memory` succeeds

**Test with API Key**: `brain_y6NFzv-Gx3UITfJgG0tWwd6XgeZbOCxAKNJ_Kjo2JjT8PAipLWGIPH-xRDQHyZAv`

---

#### Test 1.2: Recall Memory
**Command**: `Nexus: Recall Memory`

**Steps**:
1. Run `Nexus: Recall Memory`
2. Enter query: `"authentication code"`
3. Verify results displayed in tree view

**Expected Result**:
- ✅ Semantic search returns relevant memories
- ✅ Results show relevance scores (0.0-1.0)
- ✅ Clicking result shows full memory

**API Endpoint**: `POST /graphrag/api/memory/recall`

---

#### Test 1.3: Index Repository
**Command**: `Nexus: Index Repository`

**Steps**:
1. Open a workspace with code files
2. Run `Nexus: Index Repository`
3. Monitor progress notification
4. Wait for completion

**Expected Result**:
- ✅ Progress bar shows file processing
- ✅ Success message shows statistics (files, entities, relationships)
- ✅ Repository indexed in GraphRAG
- ✅ Can query indexed code

**Estimated Time**: 1-5 minutes (depending on repo size)

---

#### Test 1.4: Query Knowledge Graph
**Command**: `Nexus: Query Knowledge Graph`

**Steps**:
1. Run `Nexus: Query Knowledge Graph`
2. Enter query: `"How does authentication work?"`
3. View results in markdown document

**Expected Result**:
- ✅ Natural language query processed
- ✅ Results ranked by relevance
- ✅ Code snippets included in results
- ✅ Markdown formatted output

**Query Handler**: Uses `QueryHandler` from handlers

---

#### Test 1.5: Explain Code
**Command**: `Nexus: Explain Code (with History)`

**Steps**:
1. Open a file in git repository
2. Select a code block
3. Run `Nexus: Explain Code`
4. View explanation with git history

**Expected Result**:
- ✅ Explanation includes "why" code was written
- ✅ Git commit history shown
- ✅ AI-generated insights included
- ✅ Related commits linked

**Requirements**: File must be in a git repository

---

#### Test 1.6: Impact Analysis
**Command**: `Nexus: Analyze Impact`

**Steps**:
1. Select a function or class
2. Run `Nexus: Analyze Impact`
3. Review impact report

**Expected Result**:
- ✅ Shows direct callers
- ✅ Shows affected files by depth
- ✅ Risk level calculated (LOW/MEDIUM/HIGH/CRITICAL)
- ✅ Impact score displayed
- ✅ Recommendations provided

**Example**: Analyze impact of changing `getUserById()` function

---

#### Test 1.7: File History
**Command**: `Nexus: Show File History`

**Steps**:
1. Open a file
2. Run `Nexus: Show File History`
3. View timeline in markdown

**Expected Result**:
- ✅ Commit history displayed by month
- ✅ Authors, dates, messages shown
- ✅ Lines changed statistics included
- ✅ Formatted as timeline

---

#### Test 1.8: Security Scan
**Command**: `Nexus: Security Scan`

**Steps**:
1. Open a workspace with package.json or similar
2. Run `Nexus: Security Scan`
3. Review vulnerability report

**Expected Result**:
- ✅ Dependencies scanned
- ✅ Vulnerabilities grouped by severity
- ✅ CVEs identified
- ✅ Fix recommendations provided
- ✅ Diagnostic warnings shown in Problems panel

**Supported Ecosystems**: npm, PyPI, Go, Rust, Maven, PHP, Ruby, NuGet

---

#### Test 1.9: Generate Tests
**Command**: `Nexus: Generate Tests`

**Steps**:
1. Select a function
2. Run `Nexus: Generate Tests`
3. Choose test framework (Jest/Vitest/Pytest/etc.)
4. Preview generated tests
5. Create or append to test file

**Expected Result**:
- ✅ Test cases generated
- ✅ Framework-specific syntax
- ✅ Edge cases included
- ✅ Mocks generated
- ✅ Option to preview, create, or append

**Supported Frameworks**: Jest, Vitest, Pytest, Go Test, Rust Test, JUnit

---

### Phase 2: NexusMind Visualizations (6 tests)

**Note**: These commands currently show placeholder messages. Full WebView implementation is pending (Phase 2).

#### Test 2.1: Dependency Graph
**Command**: `NexusMind: Dependency Graph`

**Current Status**: ⏳ Placeholder
**Expected Result**: Shows info message: "📊 Dependency Graph visualization coming soon!"

**Future Implementation**:
- WebView panel with interactive graph
- 4 layout algorithms: force-directed, hierarchical, radial, organic
- Node types: files, functions, classes, modules
- Metrics: complexity, change frequency, impact score

---

#### Test 2.2: Evolution Timeline
**Command**: `NexusMind: Evolution Timeline`

**Current Status**: ⏳ Placeholder
**Expected Result**: Shows info message: "📈 Evolution Timeline visualization coming soon!"

**Future Implementation**:
- Timeline visualization of code history
- AI-generated insights
- Commit frequency heatmap
- Statistics and trends

---

#### Test 2.3: Impact Ripple
**Command**: `NexusMind: Impact Ripple`

**Current Status**: ⏳ Placeholder
**Expected Result**: Shows info message: "🌊 Impact Ripple visualization coming soon!"

**Future Implementation**:
- Concentric rings showing change propagation
- Depth-based visualization
- Risk levels with color coding
- Interactive navigation

---

#### Test 2.4: Semantic Clusters
**Command**: `NexusMind: Semantic Clusters`

**Current Status**: ⏳ Placeholder
**Expected Result**: Shows info message: "🔮 Semantic Clusters visualization coming soon!"

**Future Implementation**:
- AI-powered code grouping
- 3 algorithms: KMeans, DBSCAN, Hierarchical
- Visual clusters with labels
- Similarity scores

---

#### Test 2.5: Architecture Analysis
**Command**: `NexusMind: Analyze Architecture`

**Current Status**: ⏳ Placeholder
**Expected Result**: Shows info message: "🏗️ Architecture Analysis coming soon!"

**Future Implementation**:
- Code smell detection (6 types)
- Circular dependency detection
- God class identification
- Refactoring suggestions
- Diagnostic panel integration

---

#### Test 2.6: Natural Language Query
**Command**: `NexusMind: Natural Language Query`

**Current Status**: ⏳ Placeholder
**Steps**:
1. Run command
2. Enter query (e.g., "Show me all database models")
3. See placeholder message

**Expected Result**: Shows info message with query

**Future Implementation**:
- Intent parsing (8 types)
- Visual query results
- Multi-visualization response
- Interactive exploration

---

### Phase 3: Tree Views (2 tests)

#### Test 3.1: Memories View
**Location**: Nexus sidebar → Memories tab

**Steps**:
1. Open Nexus sidebar
2. Click Memories tab
3. View stored memories

**Expected Result**:
- ✅ Lists recent memories (limit 10)
- ✅ Shows tags for each memory
- ✅ Clicking expands full content
- ✅ Icons displayed

---

#### Test 3.2: NexusMind View
**Location**: Nexus sidebar → NexusMind tab

**Current Status**: ⏳ Placeholder
**Expected Result**: Shows "Coming Soon" message

---

## API Integration Tests

### GraphRAG API Endpoints

Test with API key: `brain_y6NFzv-Gx3UITfJgG0tWwd6XgeZbOCxAKNJ_Kjo2JjT8PAipLWGIPH-xRDQHyZAv`

#### Endpoint 1: Store Memory
```bash
curl -X POST https://api.adverant.ai/graphrag/api/memory \
  -H "Authorization: Bearer brain_y6NFzv-Gx3UITfJgG0tWwd6XgeZbOCxAKNJ_Kjo2JjT8PAipLWGIPH-xRDQHyZAv" \
  -H "Content-Type: application/json" \
  -H "X-Company-ID: adverant" \
  -H "X-App-ID: vscode-nexus" \
  -H "X-User-ID: test-user" \
  -d '{
    "content": "function authenticate(user, password) { /* ... */ }",
    "tags": ["authentication", "testing"]
  }'
```

**Expected**: `200 OK` with `memoryId`

---

#### Endpoint 2: Recall Memory
```bash
curl -X POST https://api.adverant.ai/graphrag/api/memory/recall \
  -H "Authorization: Bearer brain_y6NFzv-Gx3UITfJgG0tWwd6XgeZbOCxAKNJ_Kjo2JjT8PAipLWGIPH-xRDQHyZAv" \
  -H "Content-Type: application/json" \
  -H "X-Company-ID: adverant" \
  -H "X-App-ID: vscode-nexus" \
  -H "X-User-ID: test-user" \
  -d '{
    "query": "authentication",
    "limit": 5
  }'
```

**Expected**: `200 OK` with array of memories and relevance scores

---

#### Endpoint 3: List Memories
```bash
curl -X GET "https://api.adverant.ai/graphrag/api/memories?limit=10&offset=0" \
  -H "Authorization: Bearer brain_y6NFzv-Gx3UITfJgG0tWwd6XgeZbOCxAKNJ_Kjo2JjT8PAipLWGIPH-xRDQHyZAv" \
  -H "X-Company-ID: adverant" \
  -H "X-App-ID: vscode-nexus" \
  -H "X-User-ID: test-user"
```

**Expected**: `200 OK` with paginated memories list

---

### MageAgent API (Multi-Model AI)

#### Endpoint: Orchestrate
```bash
curl -X POST https://api.adverant.ai/mageagent/orchestrate \
  -H "Authorization: Bearer brain_y6NFzv-Gx3UITfJgG0tWwd6XgeZbOCxAKNJ_Kjo2JjT8PAipLWGIPH-xRDQHyZAv" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Generate test cases for function getUserById",
    "context": "function getUserById(id) { /* ... */ }"
  }'
```

**Expected**: `200 OK` with job ID and orchestration result

---

## Error Handling Tests

### Test: Invalid API Key
1. Configure with invalid API key
2. Try any command
3. Verify error message: "Unauthorized" or "Invalid API key"

### Test: Network Error
1. Disconnect from internet
2. Try any command
3. Verify error message: "Network error" or "Cannot connect"

### Test: Empty Selection
1. Run `Store Memory` without selecting code
2. Verify error: "No code selected"

### Test: No Workspace
1. Close all workspaces
2. Run `Index Repository`
3. Verify error: "No workspace folder open"

---

## Performance Tests

### Indexing Performance
- **Small repo** (< 100 files): < 1 minute
- **Medium repo** (100-1000 files): 1-5 minutes
- **Large repo** (> 1000 files): 5-15 minutes

### Query Performance
- **Memory recall**: < 1 second
- **Knowledge graph query**: 1-3 seconds
- **Impact analysis**: 2-5 seconds

---

## Test Results Template

```markdown
## Test Results - [Date]

### Core Commands
- [ ] Store Memory - PASS/FAIL
- [ ] Recall Memory - PASS/FAIL
- [ ] Index Repository - PASS/FAIL
- [ ] Query Knowledge Graph - PASS/FAIL
- [ ] Explain Code - PASS/FAIL
- [ ] Analyze Impact - PASS/FAIL
- [ ] Show File History - PASS/FAIL
- [ ] Security Scan - PASS/FAIL
- [ ] Generate Tests - PASS/FAIL

### NexusMind Visualizations
- [ ] Dependency Graph - Placeholder shown
- [ ] Evolution Timeline - Placeholder shown
- [ ] Impact Ripple - Placeholder shown
- [ ] Semantic Clusters - Placeholder shown
- [ ] Architecture Analysis - Placeholder shown
- [ ] Natural Language Query - Placeholder shown

### API Integration
- [ ] Store Memory API - PASS/FAIL
- [ ] Recall Memory API - PASS/FAIL
- [ ] List Memories API - PASS/FAIL
- [ ] MageAgent Orchestrate - PASS/FAIL

### Error Handling
- [ ] Invalid API key - PASS/FAIL
- [ ] Network error - PASS/FAIL
- [ ] Empty selection - PASS/FAIL
- [ ] No workspace - PASS/FAIL

### Notes
[Add any issues, bugs, or observations here]
```

---

## Known Limitations

1. **Node.js Required**: Extension cannot be built without Node.js 20+
2. **NexusMind Visualizations**: Currently placeholders, WebView implementation pending
3. **Git Required**: File history and explain code require git repository
4. **API Key Required**: All features require valid Adverant API key

---

## Next Steps

1. ✅ Install Node.js 20+
2. ⏳ Build and package extension
3. ⏳ Install in VSCode
4. ⏳ Configure API key
5. ⏳ Run all tests
6. ⏳ Document results
7. ⏳ Fix any bugs found
8. ⏳ Implement WebView panels (Phase 2)

---

**Testing Status**: Awaiting Node.js installation
**Last Updated**: December 26, 2025
