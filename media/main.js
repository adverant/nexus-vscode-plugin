/**
 * Nexus VSCode Plugin - Main JavaScript
 * Handles UI interactions and communication with extension backend
 */
(function() {
    'use strict';

    // ========================================================================
    // VSCode API & State
    // ========================================================================

    const vscode = acquireVsCodeApi();
    const pendingRequests = new Map();
    let uploadQueue = [];
    let currentUser = null;
    let pluginAccess = {
        fileprocess: { allowed: false, message: 'Checking...' }
    };

    // ========================================================================
    // Utility Functions
    // ========================================================================

    function generateId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    function sendRequest(command, params) {
        return new Promise((resolve, reject) => {
            const id = generateId();
            pendingRequests.set(id, { resolve, reject });

            vscode.postMessage({
                type: 'request',
                data: { id, command, params }
            });

            setTimeout(() => {
                if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 30000);
        });
    }

    // ========================================================================
    // Message Handling
    // ========================================================================

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

    // ========================================================================
    // UI Helpers
    // ========================================================================

    function showLoading(message = 'Processing...') {
        const overlay = document.getElementById('loading-overlay');
        const messageEl = document.getElementById('loading-message');
        if (messageEl) messageEl.textContent = message;
        if (overlay) overlay.style.display = 'flex';
    }

    function hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        container.appendChild(toast);

        setTimeout(() => toast.remove(), 5000);
    }

    function showError(message) {
        showToast(message, 'error');
    }

    function showSuccess(message) {
        showToast(message, 'success');
    }

    // ========================================================================
    // Tab Navigation
    // ========================================================================

    function showTab(tabId) {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });

        loadTabData(tabId);
    }

    function loadTabData(tabId) {
        switch (tabId) {
            case 'home':
                loadHomeTab();
                break;
            case 'memory':
                loadMemoryTab();
                break;
            case 'explore':
                // Explore tab loads on demand
                break;
            case 'settings':
                loadSettingsTab();
                break;
        }
    }

    // ========================================================================
    // Section Toggle
    // ========================================================================

    window.toggleSection = function(header) {
        const section = header.closest('.section');
        const content = section.querySelector('.section-content');
        const isCollapsed = header.classList.contains('collapsed');

        header.classList.toggle('collapsed', !isCollapsed);
        content.style.display = isCollapsed ? 'block' : 'none';
    };

    // ========================================================================
    // HOME TAB
    // ========================================================================

    async function loadHomeTab() {
        await Promise.all([
            loadConnectionStatus(),
            loadPluginStatus(),
            loadRecentMemories(),
            loadRepoStats()
        ]);
    }

    async function loadConnectionStatus() {
        const statusEl = document.getElementById('connection-status');
        if (!statusEl) return;

        try {
            const status = await sendRequest('getApiStatus', {});
            const indicator = statusEl.querySelector('.connection-indicator');
            const label = statusEl.querySelector('.connection-label');

            if (status.configured) {
                indicator.className = 'connection-indicator connected';
                label.textContent = 'Connected to GraphRAG API';
            } else {
                indicator.className = 'connection-indicator disconnected';
                label.innerHTML = `Not configured. <a href="#" onclick="showTab('settings'); return false;">Configure API</a>`;
            }
        } catch (error) {
            const indicator = statusEl.querySelector('.connection-indicator');
            const label = statusEl.querySelector('.connection-label');
            indicator.className = 'connection-indicator disconnected';
            label.textContent = `Error: ${error.message}`;
        }
    }

    async function loadPluginStatus() {
        const statusEl = document.getElementById('plugin-status');
        if (!statusEl) return;

        try {
            const subscription = await sendRequest('getUserSubscription', {});

            if (!subscription) {
                statusEl.innerHTML = '<div class="empty-state small"><p>Connect account to view plugins</p></div>';
                return;
            }

            const plugins = subscription.plugins || [];
            // Map internal names to addon slugs used in the backend
            const corePlugins = [
                { name: 'graphrag', slugs: ['graph-rag', 'graphrag'], displayName: 'GraphRAG Core' },
                { name: 'fileprocess', slugs: ['file-processing', 'fileprocess'], displayName: 'FileProcess' },
                { name: 'geoagent', slugs: ['geo-agent', 'geoagent'], displayName: 'GeoAgent' },
                { name: 'crm', slugs: ['nexus-crm', 'crm'], displayName: 'CRM' }
            ];

            let html = '';
            for (const core of corePlugins) {
                // Match plugin by any of the possible slugs (addon_name or pluginName)
                const plugin = plugins.find(p =>
                    core.slugs.includes(p.pluginName) ||
                    core.slugs.includes(p.pluginId) ||
                    p.pluginName === core.name
                );
                // GraphRAG Core is always enabled by default
                const subscribed = core.name === 'graphrag' ? true : (plugin?.subscribed || false);
                const tier = plugin?.tier || 'free';

                html += `
                    <div class="plugin-card ${subscribed ? 'active' : ''}">
                        <div class="plugin-name">${core.displayName}</div>
                        <div class="plugin-tier">${subscribed ? tier : 'Not subscribed'}</div>
                        <span class="status-badge ${subscribed ? 'active' : 'inactive'}">
                            ${subscribed ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                `;

                if (core.name === 'fileprocess') {
                    pluginAccess.fileprocess = { allowed: subscribed, message: subscribed ? '' : 'Requires FileProcess plugin' };
                }
            }

            statusEl.innerHTML = html;
            updateUploadAvailability();

        } catch (error) {
            statusEl.innerHTML = `<div class="empty-state small"><p>Unable to load plugins: ${error.message}</p></div>`;
        }
    }

    async function loadRecentMemories() {
        const memoriesEl = document.getElementById('recent-memories');
        if (!memoriesEl) return;

        try {
            const data = await sendRequest('getRecentMemories', { limit: 5 });

            if (data.memories && data.memories.length > 0) {
                memoriesEl.innerHTML = data.memories.map(m => `
                    <div class="memory-result">
                        <div class="memory-result-header">
                            <span class="memory-result-type">${m.type || 'memory'}</span>
                            <span class="memory-result-score">Score: ${m.score?.toFixed(2) || '--'}</span>
                        </div>
                        <div class="memory-result-content">
                            ${(m.content || '').substring(0, 150)}${(m.content || '').length > 150 ? '...' : ''}
                        </div>
                    </div>
                `).join('');
            } else {
                memoriesEl.innerHTML = '<div class="empty-state"><p>No recent memories</p></div>';
            }
        } catch (error) {
            memoriesEl.innerHTML = `<div class="empty-state"><p>Unable to load: ${error.message}</p></div>`;
        }
    }

    async function loadRepoStats() {
        const statsEl = document.getElementById('repo-stats');
        if (!statsEl) return;

        try {
            const stats = await sendRequest('getRepoStats', {});
            const statCards = statsEl.querySelectorAll('.stat-card');

            if (statCards.length >= 3) {
                statCards[0].querySelector('.stat-value').textContent = stats.memories || '--';
                statCards[1].querySelector('.stat-value').textContent = stats.entities || '--';
                statCards[2].querySelector('.stat-value').textContent = stats.relationships || '--';
            }
        } catch (error) {
            // Keep defaults
        }
    }

    // ========================================================================
    // MEMORY TAB
    // ========================================================================

    async function loadMemoryTab() {
        loadSkillsAndHooks();
    }

    async function storeMemoryFromForm() {
        const title = document.getElementById('memory-title').value;
        const content = document.getElementById('memory-content').value;
        const tags = document.getElementById('memory-tags').value;
        const type = document.getElementById('memory-type').value;

        if (!content.trim()) {
            showError('Please enter content to store');
            return;
        }

        try {
            showLoading('Storing memory...');
            await sendRequest('storeMemory', {
                content: title ? `${title}\n\n${content}` : content,
                tags: tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [],
                metadata: { type }
            });

            hideLoading();
            showSuccess('Memory stored successfully');

            // Clear form
            document.getElementById('memory-title').value = '';
            document.getElementById('memory-content').value = '';
            document.getElementById('memory-tags').value = '';
        } catch (error) {
            hideLoading();
            showError(error.message);
        }
    }

    async function searchMemories() {
        const query = document.getElementById('search-query').value;
        const domain = document.getElementById('filter-domain').value;
        const type = document.getElementById('filter-type').value;
        const resultsEl = document.getElementById('search-results');

        if (!query.trim()) {
            showError('Please enter a search query');
            return;
        }

        try {
            showLoading('Searching...');
            const data = await sendRequest('searchMemories', {
                query,
                domain: domain || undefined,
                type: type || undefined,
                limit: 20
            });

            hideLoading();

            if (data.results && data.results.length > 0) {
                resultsEl.innerHTML = data.results.map(r => `
                    <div class="memory-result">
                        <div class="memory-result-header">
                            <span class="memory-result-type">${r.type || 'result'}</span>
                            <span class="memory-result-score">Score: ${r.score?.toFixed(2) || '--'}</span>
                        </div>
                        <div class="memory-result-content">${(r.content || '').substring(0, 300)}...</div>
                        ${r.tags?.length ? `
                            <div class="memory-result-tags">
                                ${r.tags.map(t => `<span class="memory-tag">${t}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                `).join('');
            } else {
                resultsEl.innerHTML = '<div class="empty-state"><p>No results found</p></div>';
            }
        } catch (error) {
            hideLoading();
            resultsEl.innerHTML = `<div class="empty-state"><p>Error: ${error.message}</p></div>`;
        }
    }

    async function loadEpisodes() {
        const startDate = document.getElementById('episode-start').value;
        const endDate = document.getElementById('episode-end').value;
        const timelineEl = document.getElementById('episodic-timeline');

        try {
            showLoading('Loading episodes...');
            const data = await sendRequest('getEpisodicData', {
                timeRange: { start: startDate, end: endDate },
                limit: 50
            });

            hideLoading();

            if (data.sessions && data.sessions.length > 0) {
                timelineEl.innerHTML = data.sessions.map(session => `
                    <div class="timeline-session">
                        <div class="timeline-session-header">
                            <span class="timeline-session-id">${session.sessionId?.substring(0, 8) || 'Unknown'}...</span>
                            <span class="timeline-session-date">${session.firstEvent ? new Date(session.firstEvent).toLocaleDateString() : ''}</span>
                        </div>
                        <div class="timeline-events">${session.eventCount} events</div>
                    </div>
                `).join('');
            } else {
                timelineEl.innerHTML = '<div class="empty-state"><p>No episodes found</p></div>';
            }
        } catch (error) {
            hideLoading();
            timelineEl.innerHTML = `<div class="empty-state"><p>Error: ${error.message}</p></div>`;
        }
    }

    async function loadSkillsAndHooks() {
        const skillsList = document.getElementById('skills-list');
        const hooksList = document.getElementById('hooks-list');

        try {
            const data = await sendRequest('getSkillsAndHooks', {});

            if (skillsList && data.skills) {
                if (data.skills.length > 0) {
                    skillsList.innerHTML = data.skills.map(skill => `
                        <div class="memory-result">
                            <div class="memory-result-header">
                                <span class="memory-result-type">${skill.name}</span>
                            </div>
                            <div class="memory-result-content">${skill.description || 'No description'}</div>
                        </div>
                    `).join('');
                } else {
                    skillsList.innerHTML = '<div class="empty-state small"><p>No skills installed</p></div>';
                }
            }

            if (hooksList && data.hooks) {
                if (data.hooks.length > 0) {
                    hooksList.innerHTML = data.hooks.map(hook => `
                        <div class="memory-result">
                            <div class="memory-result-header">
                                <span class="memory-result-type">${hook.event}</span>
                            </div>
                            <div class="memory-result-content" style="font-family: monospace; font-size: 11px;">
                                ${hook.command}
                            </div>
                        </div>
                    `).join('');
                } else {
                    hooksList.innerHTML = '<div class="empty-state small"><p>No hooks configured</p></div>';
                }
            }
        } catch (error) {
            if (skillsList) skillsList.innerHTML = '<div class="empty-state small"><p>Error loading skills</p></div>';
            if (hooksList) hooksList.innerHTML = '<div class="empty-state small"><p>Error loading hooks</p></div>';
        }
    }

    // ========================================================================
    // UPLOAD FUNCTIONALITY
    // ========================================================================

    function updateUploadAvailability() {
        const dropzone = document.getElementById('upload-dropzone');
        if (!dropzone) return;

        if (!pluginAccess.fileprocess.allowed) {
            dropzone.classList.add('locked');
        } else {
            dropzone.classList.remove('locked');
        }
    }

    function setupUploadHandlers() {
        const dropzone = document.getElementById('upload-dropzone');
        const fileInput = document.getElementById('file-upload-input');

        if (!dropzone || !fileInput) return;

        dropzone.addEventListener('click', () => {
            if (!pluginAccess.fileprocess.allowed) {
                showError('FileProcess plugin required for uploads');
                return;
            }
            fileInput.click();
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (pluginAccess.fileprocess.allowed) {
                dropzone.classList.add('drag-over');
            }
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('drag-over');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
            if (!pluginAccess.fileprocess.allowed) {
                showError('FileProcess plugin required for uploads');
                return;
            }
            handleFileSelection(e.dataTransfer.files);
        });

        fileInput.addEventListener('change', () => {
            handleFileSelection(fileInput.files);
            fileInput.value = '';
        });
    }

    async function handleFileSelection(files) {
        const tagsInput = document.getElementById('upload-tags').value;
        const collectionName = document.getElementById('series-name').value;
        const sequenceNumber = document.getElementById('book-number').value;

        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

        for (const file of files) {
            addToUploadQueue(file, tags, collectionName, sequenceNumber);
        }

        processUploadQueue();
    }

    function addToUploadQueue(file, tags, collectionName, sequenceNumber) {
        const item = {
            id: generateId(),
            file,
            tags,
            collectionName,
            sequenceNumber: sequenceNumber ? parseInt(sequenceNumber) : undefined,
            status: 'pending',
            progress: 0
        };

        uploadQueue.push(item);
        renderUploadQueue();
    }

    function renderUploadQueue() {
        const queueEl = document.getElementById('upload-queue');
        if (!queueEl) return;

        if (uploadQueue.length === 0) {
            queueEl.innerHTML = '';
            return;
        }

        queueEl.innerHTML = uploadQueue.map(item => {
            const icon = getFileIcon(item.file.name);
            const statusText = {
                pending: 'Waiting...',
                uploading: 'Uploading...',
                processing: 'Processing...',
                completed: 'Completed',
                failed: item.error || 'Failed'
            }[item.status];

            return `
                <div class="upload-item">
                    <span class="upload-item-icon">${icon}</span>
                    <div class="upload-item-info">
                        <div class="upload-item-name">${item.file.name}</div>
                        <div class="upload-item-status">${statusText}</div>
                        ${item.status === 'uploading' || item.status === 'processing' ? `
                            <div class="upload-progress">
                                <div class="upload-progress-bar" style="width: ${item.progress}%"></div>
                            </div>
                        ` : ''}
                    </div>
                    ${item.status === 'pending' ? `
                        <button class="btn btn-secondary btn-sm" onclick="window.removeFromQueue('${item.id}')">Remove</button>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    function getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const icons = {
            pdf: '📄', doc: '📄', docx: '📄', txt: '📄',
            jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️',
            mp4: '🎬', mov: '🎬', avi: '🎬', webm: '🎬',
            mp3: '🎵', wav: '🎵', flac: '🎵',
            zip: '📦', tar: '📦', gz: '📦', rar: '📦',
            json: '📋', xml: '📋', csv: '📋',
            las: '📍', laz: '📍', xyz: '📍'
        };
        return icons[ext] || '📎';
    }

    window.removeFromQueue = function(id) {
        uploadQueue = uploadQueue.filter(item => item.id !== id);
        renderUploadQueue();
    };

    async function processUploadQueue() {
        const pendingItems = uploadQueue.filter(item => item.status === 'pending');

        for (const item of pendingItems) {
            item.status = 'uploading';
            renderUploadQueue();

            try {
                const base64 = await readFileAsBase64(item.file);
                item.progress = 50;
                renderUploadQueue();

                const result = await sendRequest('uploadDocument', {
                    filename: item.file.name,
                    content: base64,
                    mimeType: item.file.type || 'application/octet-stream',
                    tags: item.tags,
                    collectionName: item.collectionName,
                    sequenceNumber: item.sequenceNumber
                });

                if (result.success) {
                    item.status = 'processing';
                    item.jobId = result.jobId;
                    item.progress = 75;
                    renderUploadQueue();
                    pollJobStatus(item);
                } else {
                    item.status = 'failed';
                    item.error = result.error || 'Upload failed';
                    renderUploadQueue();
                }
            } catch (error) {
                item.status = 'failed';
                item.error = error.message;
                renderUploadQueue();
            }
        }
    }

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function pollJobStatus(item) {
        const poll = async () => {
            try {
                const result = await sendRequest('getJobStatus', { jobId: item.jobId });
                const job = result.job;

                if (job.status === 'completed') {
                    item.status = 'completed';
                    item.progress = 100;
                    renderUploadQueue();
                    showSuccess(`${item.file.name} processed successfully`);
                } else if (job.status === 'failed') {
                    item.status = 'failed';
                    item.error = job.error || 'Processing failed';
                    renderUploadQueue();
                } else {
                    item.progress = job.progress || 75;
                    renderUploadQueue();
                    setTimeout(poll, 2000);
                }
            } catch (error) {
                item.status = 'failed';
                item.error = error.message;
                renderUploadQueue();
            }
        };

        poll();
    }

    // ========================================================================
    // EXPLORE TAB (Visualizations & Code Intelligence)
    // ========================================================================

    function updateVizControls() {
        const vizType = document.getElementById('viz-type').value;
        const filePathGroup = document.getElementById('file-path-group');
        const layoutGroup = document.getElementById('layout-group');
        const queryGroup = document.getElementById('query-group');

        if (filePathGroup) filePathGroup.style.display = vizType === 'nlQuery' ? 'none' : 'flex';
        if (layoutGroup) layoutGroup.style.display = vizType === 'dependencyGraph' ? 'flex' : 'none';
        if (queryGroup) queryGroup.style.display = vizType === 'nlQuery' ? 'flex' : 'none';
    }

    async function generateVisualization() {
        const vizType = document.getElementById('viz-type').value;
        let filePath = document.getElementById('file-path').value || 'src/extension.ts';
        const layoutAlgorithm = document.getElementById('layout-algorithm')?.value || 'force';
        const nlQuery = document.getElementById('nl-query')?.value;
        const vizContainer = document.getElementById('viz-container');

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
                    renderGenericResult(vizContainer, 'Evolution Timeline', data);
                    break;
                case 'impactRipple':
                    data = await sendRequest('getImpactRipple', { filePath });
                    renderGenericResult(vizContainer, 'Impact Ripple', data);
                    break;
                case 'semanticClusters':
                    data = await sendRequest('getSemanticClusters', { repositoryPath: filePath || '.' });
                    renderGenericResult(vizContainer, 'Semantic Clusters', data);
                    break;
                case 'architecture':
                    data = await sendRequest('analyzeArchitecture', { repositoryPath: filePath || '.' });
                    renderGenericResult(vizContainer, 'Architecture Analysis', data);
                    break;
                case 'nlQuery':
                    if (!nlQuery) {
                        throw new Error('Please enter a query');
                    }
                    data = await sendRequest('nlQuery', { query: nlQuery, repositoryPath: filePath || '.' });
                    renderGenericResult(vizContainer, 'Query Results', data);
                    break;
            }

            hideLoading();
        } catch (error) {
            hideLoading();
            vizContainer.innerHTML = `<div class="empty-state"><p>Error: ${error.message}</p></div>`;
        }
    }

    function renderDependencyGraph(container, data) {
        if (!data.success || !data.graph) {
            container.innerHTML = `<div class="empty-state"><p>Failed to load graph: ${data.error || 'Unknown error'}</p></div>`;
            return;
        }

        const graph = data.graph;
        if (!graph.nodes || graph.nodes.length === 0) {
            container.innerHTML = `<div class="empty-state"><p>No dependencies found</p></div>`;
            return;
        }

        container.innerHTML = `
            <div style="padding: 16px;">
                <p style="font-size: 12px; opacity: 0.7; margin-bottom: 16px;">
                    ${graph.nodes.length} nodes, ${graph.edges.length} edges
                </p>
                <div id="graph-svg-container" style="width: 100%; height: 400px; border: 1px solid var(--vscode-panel-border); border-radius: 8px;"></div>
            </div>
        `;

        // Render with D3 if available
        if (typeof d3 !== 'undefined') {
            renderD3Graph(document.getElementById('graph-svg-container'), graph);
        }
    }

    function renderD3Graph(container, graph) {
        const width = container.clientWidth;
        const height = 400;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const simulation = d3.forceSimulation(graph.nodes)
            .force('link', d3.forceLink(graph.edges).id(d => d.id).distance(80))
            .force('charge', d3.forceManyBody().strength(-200))
            .force('center', d3.forceCenter(width / 2, height / 2));

        const link = svg.append('g')
            .selectAll('line')
            .data(graph.edges)
            .enter().append('line')
            .attr('stroke', 'var(--vscode-panel-border)')
            .attr('stroke-width', 1);

        const node = svg.append('g')
            .selectAll('circle')
            .data(graph.nodes)
            .enter().append('circle')
            .attr('r', 6)
            .attr('fill', 'var(--vscode-textLink-foreground)')
            .call(d3.drag()
                .on('start', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0.3).restart();
                    d.fx = d.x;
                    d.fy = d.y;
                })
                .on('drag', (event, d) => {
                    d.fx = event.x;
                    d.fy = event.y;
                })
                .on('end', (event, d) => {
                    if (!event.active) simulation.alphaTarget(0);
                    d.fx = null;
                    d.fy = null;
                }));

        node.append('title').text(d => d.label || d.id);

        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
        });
    }

    function renderGenericResult(container, title, data) {
        container.innerHTML = `
            <div style="padding: 16px;">
                <h3 style="margin-bottom: 12px;">${title}</h3>
                <pre style="background: var(--vscode-textCodeBlock-background); padding: 12px; border-radius: 4px; overflow: auto; max-height: 350px; font-size: 11px;">${JSON.stringify(data, null, 2)}</pre>
            </div>
        `;
    }

    async function useSelection() {
        vscode.postMessage({ type: 'getSelection' });
    }

    async function explainCode() {
        const code = document.getElementById('code-input').value;
        const resultsEl = document.getElementById('intelligence-results');

        if (!code.trim()) {
            showError('Please enter code or use selection');
            return;
        }

        try {
            showLoading('Analyzing code...');
            const result = await sendRequest('explainCode', { code });
            hideLoading();
            resultsEl.innerHTML = `<div style="padding: 16px; white-space: pre-wrap;">${result.explanation || JSON.stringify(result, null, 2)}</div>`;
        } catch (error) {
            hideLoading();
            resultsEl.innerHTML = `<div class="empty-state"><p>Error: ${error.message}</p></div>`;
        }
    }

    async function analyzeImpact() {
        const code = document.getElementById('code-input').value;
        const resultsEl = document.getElementById('intelligence-results');

        if (!code.trim()) {
            showError('Please enter code or use selection');
            return;
        }

        try {
            showLoading('Analyzing impact...');
            const result = await sendRequest('analyzeImpact', { code });
            hideLoading();
            resultsEl.innerHTML = `<div style="padding: 16px;"><pre style="white-space: pre-wrap;">${JSON.stringify(result, null, 2)}</pre></div>`;
        } catch (error) {
            hideLoading();
            resultsEl.innerHTML = `<div class="empty-state"><p>Error: ${error.message}</p></div>`;
        }
    }

    async function viewHistory() {
        const resultsEl = document.getElementById('intelligence-results');

        try {
            showLoading('Loading history...');
            const result = await sendRequest('getFileHistory', {});
            hideLoading();
            resultsEl.innerHTML = `<div style="padding: 16px;"><pre style="white-space: pre-wrap;">${JSON.stringify(result, null, 2)}</pre></div>`;
        } catch (error) {
            hideLoading();
            resultsEl.innerHTML = `<div class="empty-state"><p>Error: ${error.message}</p></div>`;
        }
    }

    async function runSecurityScan() {
        const repoPath = document.getElementById('repo-path').value;
        const resultsEl = document.getElementById('security-results');

        try {
            showLoading('Running security scan...');
            const result = await sendRequest('runSecurityScan', { repositoryPath: repoPath || '.' });
            hideLoading();
            resultsEl.innerHTML = `<pre style="font-size: 11px; white-space: pre-wrap;">${JSON.stringify(result, null, 2)}</pre>`;
        } catch (error) {
            hideLoading();
            resultsEl.innerHTML = `<p style="color: var(--danger-color);">Error: ${error.message}</p>`;
        }
    }

    async function generateTests() {
        const code = document.getElementById('test-code-input').value;
        const framework = document.getElementById('test-framework').value;
        const resultsEl = document.getElementById('test-results');

        if (!code.trim()) {
            showError('Please enter code to test');
            return;
        }

        try {
            showLoading('Generating tests...');
            const result = await sendRequest('generateTests', { code, framework });
            hideLoading();
            resultsEl.innerHTML = `<pre style="font-size: 11px; white-space: pre-wrap;">${result.tests || JSON.stringify(result, null, 2)}</pre>`;
        } catch (error) {
            hideLoading();
            resultsEl.innerHTML = `<p style="color: var(--danger-color);">Error: ${error.message}</p>`;
        }
    }

    // ========================================================================
    // SETTINGS TAB
    // ========================================================================

    async function loadSettingsTab() {
        await Promise.all([
            loadAccountInfo(),
            loadSubscriptions()
        ]);
    }

    async function loadAccountInfo() {
        const avatarEl = document.getElementById('account-avatar');
        const emailEl = document.getElementById('account-email');
        const tierEl = document.getElementById('account-tier');

        try {
            const user = await sendRequest('getCurrentUser', {});
            currentUser = user;

            if (user && user.email) {
                const initials = user.email.substring(0, 2).toUpperCase();
                if (avatarEl) avatarEl.textContent = initials;
                if (emailEl) emailEl.textContent = user.email;
                if (tierEl) tierEl.textContent = user.tier ? `${user.tier} Plan` : 'Free Plan';
            } else {
                if (avatarEl) avatarEl.textContent = '?';
                if (emailEl) emailEl.textContent = 'Not connected';
                if (tierEl) tierEl.textContent = 'Configure API key to connect';
            }
        } catch (error) {
            if (avatarEl) avatarEl.textContent = '!';
            if (emailEl) emailEl.textContent = 'Error loading account';
            if (tierEl) tierEl.textContent = error.message;
        }
    }

    async function loadSubscriptions() {
        const subsEl = document.getElementById('subscriptions-list');
        if (!subsEl) return;

        try {
            const subscription = await sendRequest('getUserSubscription', {});

            if (subscription && subscription.plugins && subscription.plugins.length > 0) {
                subsEl.innerHTML = subscription.plugins.map(plugin => `
                    <div class="subscription-card ${plugin.subscribed ? 'active' : ''}">
                        <div class="plugin-name">${plugin.pluginName}</div>
                        <div class="plugin-tier">${plugin.tier || 'Free'}</div>
                        <span class="status-badge ${plugin.subscribed ? 'active' : 'inactive'}">
                            ${plugin.subscribed ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                `).join('');
            } else {
                subsEl.innerHTML = '<div class="empty-state small"><p>No subscriptions found</p></div>';
            }
        } catch (error) {
            subsEl.innerHTML = `<div class="empty-state small"><p>Error: ${error.message}</p></div>`;
        }
    }

    function configureApi() {
        vscode.postMessage({ type: 'executeCommand', command: 'nexus.configure', args: [] });
    }

    function clearLocalData() {
        if (confirm('Are you sure you want to clear all local data?')) {
            vscode.postMessage({ type: 'executeCommand', command: 'nexus.clearLocalData', args: [] });
            showSuccess('Local data cleared');
        }
    }

    function resetConfig() {
        if (confirm('Are you sure you want to reset all configuration?')) {
            vscode.postMessage({ type: 'executeCommand', command: 'nexus.resetConfig', args: [] });
            showSuccess('Configuration reset');
        }
    }

    function addApiKey() {
        vscode.postMessage({ type: 'executeCommand', command: 'nexus.configure', args: [] });
    }

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    document.addEventListener('DOMContentLoaded', () => {
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => showTab(tab.dataset.tab));
        });

        // Action cards (quick actions)
        document.querySelectorAll('.action-card').forEach(card => {
            card.addEventListener('click', () => {
                const action = card.dataset.action;
                vscode.postMessage({ type: 'executeCommand', command: `nexus.${action}`, args: [] });
            });
        });

        // Memory tab buttons
        const storeMemoryBtn = document.getElementById('store-memory-btn');
        if (storeMemoryBtn) storeMemoryBtn.addEventListener('click', storeMemoryFromForm);

        const searchMemoriesBtn = document.getElementById('search-memories-btn');
        if (searchMemoriesBtn) searchMemoriesBtn.addEventListener('click', searchMemories);

        const loadEpisodesBtn = document.getElementById('load-episodes-btn');
        if (loadEpisodesBtn) loadEpisodesBtn.addEventListener('click', loadEpisodes);

        const addSkillBtn = document.getElementById('add-skill-btn');
        if (addSkillBtn) addSkillBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'executeCommand', command: 'nexus.addSkill', args: [] });
        });

        // Explore tab buttons
        const vizTypeSelect = document.getElementById('viz-type');
        if (vizTypeSelect) vizTypeSelect.addEventListener('change', updateVizControls);

        const generateVizBtn = document.getElementById('generate-viz');
        if (generateVizBtn) generateVizBtn.addEventListener('click', generateVisualization);

        const useSelectionBtn = document.getElementById('use-selection');
        if (useSelectionBtn) useSelectionBtn.addEventListener('click', useSelection);

        const explainCodeBtn = document.getElementById('explain-code');
        if (explainCodeBtn) explainCodeBtn.addEventListener('click', explainCode);

        const analyzeImpactBtn = document.getElementById('analyze-impact');
        if (analyzeImpactBtn) analyzeImpactBtn.addEventListener('click', analyzeImpact);

        const viewHistoryBtn = document.getElementById('view-history');
        if (viewHistoryBtn) viewHistoryBtn.addEventListener('click', viewHistory);

        const runSecurityScanBtn = document.getElementById('run-security-scan');
        if (runSecurityScanBtn) runSecurityScanBtn.addEventListener('click', runSecurityScan);

        const generateTestsBtn = document.getElementById('generate-tests');
        if (generateTestsBtn) generateTestsBtn.addEventListener('click', generateTests);

        // Settings tab buttons
        const configureApiBtn = document.getElementById('configure-api-btn');
        if (configureApiBtn) configureApiBtn.addEventListener('click', configureApi);

        const addApiKeyBtn = document.getElementById('add-api-key-btn');
        if (addApiKeyBtn) addApiKeyBtn.addEventListener('click', addApiKey);

        const clearLocalDataBtn = document.getElementById('clear-local-data');
        if (clearLocalDataBtn) clearLocalDataBtn.addEventListener('click', clearLocalData);

        const resetConfigBtn = document.getElementById('reset-config');
        if (resetConfigBtn) resetConfigBtn.addEventListener('click', resetConfig);

        // Setup upload handlers
        setupUploadHandlers();

        // Initialize viz controls
        updateVizControls();

        // Load initial tab data
        loadHomeTab();
    });

    // Global function exports
    window.showTab = showTab;
    window.toggleSection = window.toggleSection;
    window.removeFromQueue = window.removeFromQueue;
    window.configureAPI = configureApi;
    window.browseMarketplace = () => {
        vscode.postMessage({ type: 'openExternal', url: 'https://dashboard.adverant.ai/dashboard/plugins' });
    };

})();
