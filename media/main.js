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
        let filePath = document.getElementById('file-path').value;
        const layoutAlgorithm = document.getElementById('layout-algorithm').value;
        const nlQuery = document.getElementById('nl-query').value;
        const vizContainer = document.getElementById('viz-container');

        // Auto-fill with current workspace if empty
        if (!filePath) {
            filePath = 'src/extension.ts'; // Default to extension entry point
        }

        try {
            showLoading('Generating visualization...');

            let data;
            switch (vizType) {
                case 'dependencyGraph':
                    data = await sendRequest('getDependencyGraph', { filePath, layoutAlgorithm });
                    renderDependencyGraph(vizContainer, data);
                    break;

                case 'evolutionTimeline':
                    data = await sendRequest('getEvolutionTimeline', { filePath });
                    renderEvolutionTimeline(vizContainer, data);
                    break;

                case 'impactRipple':
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
                    if (!nlQuery) {
                        throw new Error('Please enter a natural language query');
                    }
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

    // ========================================================================
    // D3.js Visualization Renderers
    // ========================================================================

    function renderDependencyGraph(container, data) {
        if (!data.success || !data.graph) {
            container.innerHTML = `<div class="error-message">Failed to load dependency graph: ${data.error || 'Unknown error'}</div>`;
            return;
        }

        const graph = data.graph;
        if (!graph.nodes || graph.nodes.length === 0) {
            container.innerHTML = `<div class="placeholder"><p>No dependencies found for this file.</p></div>`;
            return;
        }

        container.innerHTML = `
            <div style="padding: 10px;">
                <h3 style="margin-bottom: 10px;">Dependency Graph</h3>
                <p style="font-size: 12px; opacity: 0.7; margin-bottom: 10px;">${graph.nodes.length} nodes, ${graph.edges.length} edges</p>
                <div id="graph-svg-container" style="width: 100%; height: 500px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; overflow: hidden;"></div>
            </div>
        `;

        const svgContainer = document.getElementById('graph-svg-container');
        const width = svgContainer.clientWidth;
        const height = 500;

        const svg = d3.select(svgContainer)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Color scale for node types
        const colorScale = d3.scaleOrdinal()
            .domain(['file', 'function', 'class', 'method', 'module'])
            .range(['#4fc3f7', '#81c784', '#ffb74d', '#f06292', '#ba68c8']);

        // Create simulation
        const simulation = d3.forceSimulation(graph.nodes)
            .force('link', d3.forceLink(graph.edges).id(d => d.id).distance(80))
            .force('charge', d3.forceManyBody().strength(-200))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(30));

        // Draw edges
        const link = svg.append('g')
            .selectAll('line')
            .data(graph.edges)
            .enter()
            .append('line')
            .attr('stroke', 'var(--vscode-editorLineNumber-foreground)')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1.5);

        // Draw nodes
        const node = svg.append('g')
            .selectAll('g')
            .data(graph.nodes)
            .enter()
            .append('g')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        node.append('circle')
            .attr('r', d => d.type === 'file' ? 12 : 8)
            .attr('fill', d => colorScale(d.type || 'file'))
            .attr('stroke', 'var(--vscode-editor-foreground)')
            .attr('stroke-width', 1.5);

        node.append('text')
            .text(d => d.name ? d.name.split('/').pop().substring(0, 15) : '')
            .attr('x', 15)
            .attr('y', 4)
            .attr('font-size', '11px')
            .attr('fill', 'var(--vscode-editor-foreground)');

        node.append('title')
            .text(d => d.name || d.id);

        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    }

    function renderEvolutionTimeline(container, data) {
        if (!data.success || !data.timeline) {
            container.innerHTML = `<div class="error-message">Failed to load timeline: ${data.error || 'Unknown error'}</div>`;
            return;
        }

        const timeline = data.timeline;
        const events = timeline.events || [];
        const stats = timeline.statistics || {};

        container.innerHTML = `
            <div style="padding: 15px;">
                <h3 style="margin-bottom: 10px;">Evolution Timeline</h3>
                <p style="font-size: 12px; opacity: 0.7; margin-bottom: 15px;">${timeline.entity.split('/').pop()}</p>

                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
                    <div class="stat-card">
                        <div class="stat-value">${stats.totalCommits || 0}</div>
                        <div class="stat-label">Commits</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${stats.totalAuthors || 0}</div>
                        <div class="stat-label">Authors</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">+${stats.totalLinesAdded || 0}</div>
                        <div class="stat-label">Lines Added</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">-${stats.totalLinesRemoved || 0}</div>
                        <div class="stat-label">Lines Removed</div>
                    </div>
                </div>

                ${events.length === 0 ?
                    '<p style="text-align: center; opacity: 0.7;">No commits found for this file in the selected time range.</p>' :
                    `<div id="timeline-chart" style="width: 100%; height: 200px;"></div>
                     <div id="timeline-events" style="max-height: 300px; overflow-y: auto; margin-top: 15px;"></div>`
                }
            </div>
        `;

        if (events.length > 0) {
            // Render timeline chart
            const chartContainer = document.getElementById('timeline-chart');
            const width = chartContainer.clientWidth;
            const height = 200;
            const margin = { top: 20, right: 20, bottom: 30, left: 40 };

            const svg = d3.select(chartContainer)
                .append('svg')
                .attr('width', width)
                .attr('height', height);

            const x = d3.scaleTime()
                .domain(d3.extent(events, d => new Date(d.date)))
                .range([margin.left, width - margin.right]);

            const y = d3.scaleLinear()
                .domain([0, d3.max(events, d => (d.linesAdded || 0) + (d.linesRemoved || 0))])
                .range([height - margin.bottom, margin.top]);

            // Bars
            svg.selectAll('rect')
                .data(events)
                .enter()
                .append('rect')
                .attr('x', d => x(new Date(d.date)) - 5)
                .attr('y', d => y((d.linesAdded || 0) + (d.linesRemoved || 0)))
                .attr('width', 10)
                .attr('height', d => height - margin.bottom - y((d.linesAdded || 0) + (d.linesRemoved || 0)))
                .attr('fill', '#4fc3f7')
                .attr('opacity', 0.8);

            // X axis
            svg.append('g')
                .attr('transform', `translate(0,${height - margin.bottom})`)
                .call(d3.axisBottom(x).ticks(5))
                .attr('color', 'var(--vscode-editor-foreground)');

            // Render event list
            const eventsContainer = document.getElementById('timeline-events');
            eventsContainer.innerHTML = events.slice(0, 20).map(e => `
                <div style="padding: 8px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 12px;">
                    <div style="display: flex; justify-content: space-between;">
                        <strong>${e.message ? e.message.substring(0, 50) : 'No message'}</strong>
                        <span style="opacity: 0.7;">${new Date(e.date).toLocaleDateString()}</span>
                    </div>
                    <div style="opacity: 0.7; margin-top: 4px;">
                        ${e.author || 'Unknown'} •
                        <span style="color: #81c784;">+${e.linesAdded || 0}</span>
                        <span style="color: #f06292;">-${e.linesRemoved || 0}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    function renderImpactRipple(container, data) {
        if (!data.success || !data.ripple) {
            container.innerHTML = `<div class="error-message">Failed to load impact analysis: ${data.error || 'Unknown error'}</div>`;
            return;
        }

        const ripple = data.ripple;
        const layers = ripple.layers || [];

        container.innerHTML = `
            <div style="padding: 15px;">
                <h3 style="margin-bottom: 10px;">Impact Ripple Analysis</h3>
                <p style="font-size: 12px; opacity: 0.7; margin-bottom: 15px;">Source: ${ripple.sourceEntity}</p>
                <div id="ripple-svg" style="width: 100%; height: 400px;"></div>
                <div style="margin-top: 15px;">
                    <h4>Impact Summary</h4>
                    <p style="font-size: 12px; opacity: 0.8;">
                        ${ripple.summary || `${layers.length} layers of impact detected.`}
                    </p>
                </div>
            </div>
        `;

        const svgContainer = document.getElementById('ripple-svg');
        const width = svgContainer.clientWidth;
        const height = 400;
        const centerX = width / 2;
        const centerY = height / 2;

        const svg = d3.select(svgContainer)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Draw concentric circles for layers
        const maxRadius = Math.min(width, height) / 2 - 40;
        const layerCount = Math.max(layers.length, 3);

        for (let i = layerCount; i > 0; i--) {
            svg.append('circle')
                .attr('cx', centerX)
                .attr('cy', centerY)
                .attr('r', (i / layerCount) * maxRadius)
                .attr('fill', 'none')
                .attr('stroke', 'var(--vscode-editorLineNumber-foreground)')
                .attr('stroke-opacity', 0.3)
                .attr('stroke-dasharray', '4,4');
        }

        // Draw center node
        svg.append('circle')
            .attr('cx', centerX)
            .attr('cy', centerY)
            .attr('r', 15)
            .attr('fill', '#f06292');

        svg.append('text')
            .attr('x', centerX)
            .attr('y', centerY + 30)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('fill', 'var(--vscode-editor-foreground)')
            .text('Source');

        // Draw impacted nodes in each layer
        layers.forEach((layer, layerIndex) => {
            const radius = ((layerIndex + 1) / layerCount) * maxRadius;
            const entities = layer.entities || [];

            entities.forEach((entity, i) => {
                const angle = (2 * Math.PI * i) / entities.length - Math.PI / 2;
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);

                svg.append('line')
                    .attr('x1', centerX)
                    .attr('y1', centerY)
                    .attr('x2', x)
                    .attr('y2', y)
                    .attr('stroke', 'var(--vscode-editorLineNumber-foreground)')
                    .attr('stroke-opacity', 0.3);

                svg.append('circle')
                    .attr('cx', x)
                    .attr('cy', y)
                    .attr('r', 8)
                    .attr('fill', d3.interpolateBlues(1 - layerIndex / layerCount));

                svg.append('title')
                    .text(entity.name || entity.id);
            });
        });
    }

    function renderSemanticClusters(container, data) {
        if (!data.success || !data.clusters) {
            container.innerHTML = `<div class="error-message">Failed to load clusters: ${data.error || 'Unknown error'}</div>`;
            return;
        }

        const clusters = data.clusters || [];

        container.innerHTML = `
            <div style="padding: 15px;">
                <h3 style="margin-bottom: 10px;">Semantic Clusters</h3>
                <p style="font-size: 12px; opacity: 0.7; margin-bottom: 15px;">${clusters.length} clusters identified</p>
                <div id="clusters-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;"></div>
            </div>
        `;

        const clustersContainer = document.getElementById('clusters-container');
        const colors = ['#4fc3f7', '#81c784', '#ffb74d', '#f06292', '#ba68c8', '#4db6ac'];

        clusters.forEach((cluster, i) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.borderLeft = `4px solid ${colors[i % colors.length]}`;
            card.innerHTML = `
                <h4 style="margin-bottom: 8px;">${cluster.name || `Cluster ${i + 1}`}</h4>
                <p style="font-size: 12px; opacity: 0.7; margin-bottom: 8px;">${cluster.description || 'No description'}</p>
                <div style="font-size: 11px;">
                    <strong>${(cluster.entities || []).length}</strong> entities
                    ${cluster.cohesion ? ` • Cohesion: ${(cluster.cohesion * 100).toFixed(0)}%` : ''}
                </div>
                <div style="margin-top: 8px; font-size: 11px; opacity: 0.7;">
                    ${(cluster.entities || []).slice(0, 5).map(e => e.name || e).join(', ')}
                    ${(cluster.entities || []).length > 5 ? '...' : ''}
                </div>
            `;
            clustersContainer.appendChild(card);
        });

        if (clusters.length === 0) {
            clustersContainer.innerHTML = '<p style="opacity: 0.7;">No semantic clusters found. Try indexing the repository first.</p>';
        }
    }

    function renderArchitecture(container, data) {
        if (!data.success) {
            container.innerHTML = `<div class="error-message">Failed to analyze architecture: ${data.error || 'Unknown error'}</div>`;
            return;
        }

        const analysis = data.analysis || data;

        container.innerHTML = `
            <div style="padding: 15px;">
                <h3 style="margin-bottom: 10px;">Architecture Analysis</h3>

                ${analysis.patterns ? `
                <div style="margin-bottom: 20px;">
                    <h4>Detected Patterns</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                        ${(analysis.patterns || []).map(p => `
                            <span style="background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 4px 8px; border-radius: 4px; font-size: 11px;">
                                ${p.name || p}
                            </span>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                ${analysis.layers ? `
                <div style="margin-bottom: 20px;">
                    <h4>Architecture Layers</h4>
                    ${(analysis.layers || []).map((layer, i) => `
                        <div style="margin-top: 8px; padding: 10px; background: var(--vscode-editor-background); border-radius: 4px;">
                            <strong>${layer.name || `Layer ${i + 1}`}</strong>
                            <div style="font-size: 11px; opacity: 0.7; margin-top: 4px;">
                                ${layer.description || `${(layer.components || []).length} components`}
                            </div>
                        </div>
                    `).join('')}
                </div>
                ` : ''}

                ${analysis.recommendations ? `
                <div>
                    <h4>Recommendations</h4>
                    <ul style="margin-top: 8px; padding-left: 20px; font-size: 12px;">
                        ${(analysis.recommendations || []).map(r => `<li style="margin-bottom: 4px;">${r}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}

                ${!analysis.patterns && !analysis.layers && !analysis.recommendations ? `
                <pre style="font-size: 11px; overflow: auto;">${JSON.stringify(data, null, 2)}</pre>
                ` : ''}
            </div>
        `;
    }

    function renderNLQuery(container, data) {
        if (!data.success) {
            container.innerHTML = `<div class="error-message">Query failed: ${data.error || 'Unknown error'}</div>`;
            return;
        }

        const results = data.results || [];

        container.innerHTML = `
            <div style="padding: 15px;">
                <h3 style="margin-bottom: 10px;">Query Results</h3>
                <p style="font-size: 12px; opacity: 0.7; margin-bottom: 15px;">${results.length} results found</p>
                <div id="query-results"></div>
            </div>
        `;

        const resultsContainer = document.getElementById('query-results');

        if (results.length === 0) {
            resultsContainer.innerHTML = '<p style="opacity: 0.7;">No results found. Try a different query or index the repository first.</p>';
            return;
        }

        results.forEach(result => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.marginBottom = '10px';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <strong>${result.entity?.name || result.name || 'Unknown'}</strong>
                    <span style="font-size: 11px; opacity: 0.7;">${((result.score || 0) * 100).toFixed(0)}% match</span>
                </div>
                <div style="font-size: 11px; opacity: 0.7; margin: 4px 0;">
                    ${result.entity?.type || result.type || 'entity'}
                    ${result.entity?.sourceFile ? `• ${result.entity.sourceFile}` : ''}
                </div>
                ${result.explanation ? `<p style="font-size: 12px; margin-top: 8px;">${result.explanation}</p>` : ''}
                ${result.entity?.content ? `
                    <pre style="font-size: 10px; margin-top: 8px; padding: 8px; background: var(--vscode-editor-background); border-radius: 4px; overflow: auto; max-height: 150px;">${escapeHtml(result.entity.content.substring(0, 500))}${result.entity.content.length > 500 ? '...' : ''}</pre>
                ` : ''}
            `;
            resultsContainer.appendChild(card);
        });
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
