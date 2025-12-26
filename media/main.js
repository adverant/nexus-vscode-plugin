(function() {
    // Get VSCode API
    const vscode = acquireVsCodeApi();

    // Pending requests map for correlation IDs
    const pendingRequests = new Map();

    // Generate unique ID for requests
    function generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Send request to extension
    function sendRequest(command, params) {
        return new Promise((resolve, reject) => {
            const id = generateId();

            pendingRequests.set(id, { resolve, reject });

            vscode.postMessage({
                type: 'request',
                data: { id, command, params }
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
        const message = event.data;

        if (message.type === 'response') {
            const { id, success, data, error } = message.data;
            const pending = pendingRequests.get(id);

            if (pending) {
                pendingRequests.delete(id);
                if (success) {
                    pending.resolve(data);
                } else {
                    pending.reject(new Error(error || 'Unknown error'));
                }
            }
        } else if (message.type === 'showTab') {
            showTab(message.tab);
            if (message.visualizationType) {
                document.getElementById('viz-type').value = message.visualizationType;
                updateVizControls();
            }
        }
    });

    // Show loading overlay
    function showLoading(message = 'Processing...') {
        const overlay = document.getElementById('loading-overlay');
        const messageEl = document.getElementById('loading-message');
        messageEl.textContent = message;
        overlay.style.display = 'flex';
    }

    // Hide loading overlay
    function hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    }

    // Show error toast
    function showError(message) {
        const toast = document.getElementById('error-toast');
        const messageEl = document.getElementById('error-message');
        messageEl.textContent = message;
        toast.style.display = 'flex';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 5000);
    }

    // Tab switching
    function showTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabId) {
                tab.classList.add('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            if (content.id === tabId) {
                content.classList.add('active');
            }
        });

        // Load tab-specific data
        loadTabData(tabId);
    }

    // Load data for specific tabs
    function loadTabData(tabId) {
        if (tabId === 'dashboard') {
            loadDashboard();
        }
    }

    // ========================================================================
    // Dashboard Tab
    // ========================================================================

    async function loadDashboard() {
        await Promise.all([
            loadApiStatus(),
            loadRecentMemories(),
            loadRepoStats()
        ]);
    }

    async function loadApiStatus() {
        const statusEl = document.getElementById('api-status');
        try {
            const status = await sendRequest('getApiStatus', {});

            if (status.configured) {
                statusEl.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="status-indicator connected"></span>
                        <div>
                            <h3 style="margin-bottom: 4px;">Connected</h3>
                            <p style="opacity: 0.8; font-size: 12px;">GraphRAG API is configured and ready</p>
                        </div>
                    </div>
                `;
            } else {
                statusEl.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="status-indicator disconnected"></span>
                        <div>
                            <h3 style="margin-bottom: 4px;">Not Configured</h3>
                            <p style="opacity: 0.8; font-size: 12px;">${status.error || 'API not configured'}</p>
                            <button class="secondary-button" style="margin-top: 8px;" onclick="window.configureAPI()">Configure API</button>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            statusEl.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="status-indicator disconnected"></span>
                    <div>
                        <h3 style="margin-bottom: 4px;">Error</h3>
                        <p style="opacity: 0.8; font-size: 12px;">${error.message}</p>
                    </div>
                </div>
            `;
        }
    }

    async function loadRecentMemories() {
        const memoriesEl = document.getElementById('recent-memories');
        try {
            const data = await sendRequest('getRecentMemories', { limit: 5 });

            if (data.memories && data.memories.length > 0) {
                memoriesEl.innerHTML = data.memories.map(m => `
                    <div class="card" style="margin-bottom: 8px;">
                        <p style="font-size: 12px; margin-bottom: 4px; opacity: 0.8;">Score: ${m.score.toFixed(2)}</p>
                        <p style="font-size: 13px;">${m.content.substring(0, 150)}${m.content.length > 150 ? '...' : ''}</p>
                    </div>
                `).join('');
            } else {
                memoriesEl.innerHTML = '<p style="opacity: 0.7;">No memories stored yet. Use "Store Memory" to save code.</p>';
            }
        } catch (error) {
            memoriesEl.innerHTML = `<p style="opacity: 0.7;">Unable to load memories: ${error.message}</p>`;
        }
    }

    async function loadRepoStats() {
        const statsEl = document.getElementById('repo-stats');
        try {
            const workspaceFolders = await vscode.postMessage({ type: 'getWorkspaceFolders' });
            // For now, show placeholder stats
            statsEl.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                    <div style="text-align: center;">
                        <h3 style="font-size: 24px; margin-bottom: 4px;">--</h3>
                        <p style="font-size: 12px; opacity: 0.7;">Files Indexed</p>
                    </div>
                    <div style="text-align: center;">
                        <h3 style="font-size: 24px; margin-bottom: 4px;">--</h3>
                        <p style="font-size: 12px; opacity: 0.7;">Entities</p>
                    </div>
                    <div style="text-align: center;">
                        <h3 style="font-size: 24px; margin-bottom: 4px;">--</h3>
                        <p style="font-size: 12px; opacity: 0.7;">Relationships</p>
                    </div>
                </div>
                <p style="margin-top: 12px; font-size: 12px; opacity: 0.7; text-align: center;">
                    Run "Index Repository" to build knowledge graph
                </p>
            `;
        } catch (error) {
            statsEl.innerHTML = `<p style="opacity: 0.7;">Unable to load stats: ${error.message}</p>`;
        }
    }

    // Quick actions
    window.configureAPI = function() {
        vscode.postMessage({ type: 'executeCommand', command: 'nexus.configure', args: [] });
    };

    // ========================================================================
    // Visualizations Tab
    // ========================================================================

    function updateVizControls() {
        const vizType = document.getElementById('viz-type').value;
        const filePathGroup = document.getElementById('file-path-group');
        const layoutGroup = document.getElementById('layout-group');
        const queryGroup = document.getElementById('query-group');

        // Show/hide controls based on viz type
        filePathGroup.style.display = vizType === 'nlQuery' ? 'none' : 'block';
        layoutGroup.style.display = vizType === 'dependencyGraph' ? 'block' : 'none';
        queryGroup.style.display = vizType === 'nlQuery' ? 'block' : 'none';
    }

    async function generateVisualization() {
        const vizType = document.getElementById('viz-type').value;
        const filePath = document.getElementById('file-path').value;
        const layoutAlgorithm = document.getElementById('layout-algorithm').value;
        const nlQuery = document.getElementById('nl-query').value;
        const vizContainer = document.getElementById('viz-container');

        try {
            showLoading('Generating visualization...');

            let data;
            switch (vizType) {
                case 'dependencyGraph':
                    if (!filePath) throw new Error('File path is required');
                    data = await sendRequest('getDependencyGraph', { filePath, layoutAlgorithm });
                    renderDependencyGraph(vizContainer, data);
                    break;

                case 'evolutionTimeline':
                    if (!filePath) throw new Error('File path is required');
                    data = await sendRequest('getEvolutionTimeline', { filePath });
                    renderEvolutionTimeline(vizContainer, data);
                    break;

                case 'impactRipple':
                    if (!filePath) throw new Error('File path is required');
                    data = await sendRequest('getImpactRipple', { filePath });
                    renderImpactRipple(vizContainer, data);
                    break;

                case 'semanticClusters':
                    data = await sendRequest('getSemanticClusters', { repositoryPath: filePath || '.' });
                    renderSemanticClusters(vizContainer, data);
                    break;

                case 'architecture':
                    data = await sendRequest('analyzeArchitecture', { repositoryPath: filePath || '.' });
                    renderArchitecture(vizContainer, data);
                    break;

                case 'nlQuery':
                    if (!nlQuery) throw new Error('Query is required');
                    data = await sendRequest('nlQuery', { query: nlQuery, repositoryPath: filePath || '.' });
                    renderNLQuery(vizContainer, data);
                    break;
            }

            hideLoading();
        } catch (error) {
            hideLoading();
            showError(error.message);
            vizContainer.innerHTML = `
                <div class="placeholder">
                    <p>Error: ${error.message}</p>
                </div>
            `;
        }
    }

    // Placeholder renderers (will be enhanced with D3.js)
    function renderDependencyGraph(container, data) {
        container.innerHTML = `
            <div style="padding: 20px;">
                <h3>Dependency Graph</h3>
                <pre>${JSON.stringify(data, null, 2)}</pre>
                <p style="margin-top: 12px; opacity: 0.7;">D3.js visualization coming soon!</p>
            </div>
        `;
    }

    function renderEvolutionTimeline(container, data) {
        container.innerHTML = `
            <div style="padding: 20px;">
                <h3>Evolution Timeline</h3>
                <pre>${JSON.stringify(data, null, 2)}</pre>
                <p style="margin-top: 12px; opacity: 0.7;">Timeline visualization coming soon!</p>
            </div>
        `;
    }

    function renderImpactRipple(container, data) {
        container.innerHTML = `
            <div style="padding: 20px;">
                <h3>Impact Ripple</h3>
                <pre>${JSON.stringify(data, null, 2)}</pre>
                <p style="margin-top: 12px; opacity: 0.7;">Ripple visualization coming soon!</p>
            </div>
        `;
    }

    function renderSemanticClusters(container, data) {
        container.innerHTML = `
            <div style="padding: 20px;">
                <h3>Semantic Clusters</h3>
                <pre>${JSON.stringify(data, null, 2)}</pre>
                <p style="margin-top: 12px; opacity: 0.7;">Cluster visualization coming soon!</p>
            </div>
        `;
    }

    function renderArchitecture(container, data) {
        container.innerHTML = `
            <div style="padding: 20px;">
                <h3>Architecture Analysis</h3>
                <pre>${JSON.stringify(data, null, 2)}</pre>
                <p style="margin-top: 12px; opacity: 0.7;">Architecture visualization coming soon!</p>
            </div>
        `;
    }

    function renderNLQuery(container, data) {
        container.innerHTML = `
            <div style="padding: 20px;">
                <h3>NL Query Results</h3>
                <pre>${JSON.stringify(data, null, 2)}</pre>
                <p style="margin-top: 12px; opacity: 0.7;">Graph visualization coming soon!</p>
            </div>
        `;
    }

    // ========================================================================
    // Code Intelligence Tab
    // ========================================================================

    async function explainCode() {
        const codeInput = document.getElementById('code-input').value;
        if (!codeInput) {
            showError('Please enter code to explain');
            return;
        }

        const resultsEl = document.getElementById('intelligence-results');
        try {
            showLoading('Analyzing code...');
            const data = await sendRequest('explainCode', { code: codeInput });
            hideLoading();

            resultsEl.innerHTML = `
                <div>
                    <h3 style="margin-bottom: 12px;">Code Explanation</h3>
                    <div style="background-color: var(--vscode-textCodeBlock-background); padding: 16px; border-radius: 4px; margin-bottom: 16px;">
                        ${formatMarkdown(data.explanation)}
                    </div>
                </div>
            `;
        } catch (error) {
            hideLoading();
            showError(error.message);
        }
    }

    async function analyzeImpact() {
        // Get active file path (placeholder)
        showError('Please use the Visualizations tab for impact analysis');
    }

    async function viewHistory() {
        // Get active file path (placeholder)
        showError('Please use the Visualizations tab for file history');
    }

    function useSelection() {
        // Request selected text from extension
        vscode.postMessage({ type: 'executeCommand', command: 'nexus.getSelection', args: [] });
    }

    // ========================================================================
    // Security & Testing Tab
    // ========================================================================

    async function runSecurityScan() {
        const repoPath = document.getElementById('repo-path').value;
        if (!repoPath) {
            showError('Please enter a repository path');
            return;
        }

        const resultsEl = document.getElementById('security-results');
        try {
            showLoading('Scanning for vulnerabilities...');
            const data = await sendRequest('securityScan', { repositoryPath: repoPath });
            hideLoading();

            if (data.totalVulnerabilities === 0) {
                resultsEl.innerHTML = `
                    <div class="placeholder">
                        <p>✅ No vulnerabilities found!</p>
                    </div>
                `;
                return;
            }

            let html = `<h3>Found ${data.totalVulnerabilities} Vulnerabilities</h3>`;

            for (const report of data.reports) {
                if (report.vulnerabilities.length === 0) continue;

                html += `
                    <div class="card" style="margin-top: 16px;">
                        <h4>${report.dependency.name}@${report.dependency.version}</h4>
                        <p style="font-size: 12px; opacity: 0.8; margin: 8px 0;">${report.dependency.ecosystem} - ${report.dependency.filePath}</p>
                `;

                for (const vuln of report.vulnerabilities) {
                    html += `
                        <div style="margin-top: 12px; padding: 12px; background-color: var(--vscode-editor-background); border-left: 3px solid ${getSeverityColor(vuln.severity)};">
                            <span class="vulnerability-badge ${vuln.severity.toLowerCase()}">${vuln.severity}</span>
                            <h5 style="margin: 8px 0;">${vuln.summary}</h5>
                            ${vuln.details ? `<p style="font-size: 12px; margin: 8px 0;">${vuln.details}</p>` : ''}
                            ${vuln.fixedVersions && vuln.fixedVersions.length > 0 ? `<p style="font-size: 12px; margin: 8px 0;"><strong>Fixed in:</strong> ${vuln.fixedVersions.join(', ')}</p>` : ''}
                        </div>
                    `;
                }

                html += '</div>';
            }

            resultsEl.innerHTML = html;
        } catch (error) {
            hideLoading();
            showError(error.message);
        }
    }

    async function generateTests() {
        const testCodeInput = document.getElementById('test-code-input').value;
        const framework = document.getElementById('test-framework').value;

        if (!testCodeInput) {
            showError('Please enter code to generate tests for');
            return;
        }

        const resultsEl = document.getElementById('test-results');
        try {
            showLoading('Generating tests...');
            const data = await sendRequest('generateTests', { code: testCodeInput, framework });
            hideLoading();

            resultsEl.innerHTML = `
                <div>
                    <h3 style="margin-bottom: 12px;">Generated Tests (${data.framework})</h3>
                    <pre style="max-height: 500px; overflow-y: auto;">${escapeHtml(data.tests)}</pre>
                    <button class="secondary-button" style="margin-top: 12px;" onclick="window.copyTests()">Copy Tests</button>
                </div>
            `;

            // Store tests for copy function
            window.generatedTests = data.tests;
        } catch (error) {
            hideLoading();
            showError(error.message);
        }
    }

    window.copyTests = function() {
        if (window.generatedTests) {
            navigator.clipboard.writeText(window.generatedTests);
            showError('Tests copied to clipboard!'); // Using error toast for notifications
        }
    };

    // ========================================================================
    // Utilities
    // ========================================================================

    function getSeverityColor(severity) {
        const colors = {
            CRITICAL: '#d32f2f',
            HIGH: '#f57c00',
            MEDIUM: '#fbc02d',
            LOW: '#7cb342',
            UNKNOWN: '#757575'
        };
        return colors[severity] || colors.UNKNOWN;
    }

    function formatMarkdown(text) {
        // Simple markdown formatting (could be enhanced)
        return text
            .replace(/\n/g, '<br>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========================================================================
    // Event Listeners
    // ========================================================================

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            showTab(tab.dataset.tab);
        });
    });

    // Dashboard actions
    document.querySelectorAll('.action-card').forEach(card => {
        card.addEventListener('click', () => {
            const action = card.dataset.action;
            vscode.postMessage({ type: 'executeCommand', command: `nexus.${action}`, args: [] });
        });
    });

    // Visualization controls
    document.getElementById('viz-type').addEventListener('change', updateVizControls);
    document.getElementById('generate-viz').addEventListener('click', generateVisualization);

    // Code Intelligence
    document.getElementById('use-selection').addEventListener('click', useSelection);
    document.getElementById('explain-code').addEventListener('click', explainCode);
    document.getElementById('analyze-impact').addEventListener('click', analyzeImpact);
    document.getElementById('view-history').addEventListener('click', viewHistory);

    // Security & Testing
    document.getElementById('run-security-scan').addEventListener('click', runSecurityScan);
    document.getElementById('generate-tests').addEventListener('click', generateTests);

    // Error toast close button
    document.getElementById('close-error').addEventListener('click', () => {
        document.getElementById('error-toast').style.display = 'none';
    });

    // Initialize: Load dashboard on start
    loadDashboard();
})();
