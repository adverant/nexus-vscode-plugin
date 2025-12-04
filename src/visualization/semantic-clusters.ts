// src/visualization/semantic-clusters.ts
/**
 * NexusMind Semantic Clustering
 *
 * Groups code entities by semantic similarity using GraphRAG embeddings.
 * Uses clustering algorithms to identify related code patterns.
 */

import {
  SemanticCluster,
  ClusteringOptions,
  ClusteringResult,
  ClusteringAlgorithm,
  NodeType,
  Position,
} from './types.js';
import { GraphRAGClient, SearchResult } from '../clients/graphrag-client.js';
import { MageAgentClient } from '../clients/mageagent-client.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============================================================================
// Semantic Clustering Engine
// ============================================================================

export class SemanticClusteringEngine {
  constructor(
    private graphRAGClient: GraphRAGClient,
    private mageAgentClient: MageAgentClient | null
  ) {}

  /**
   * Perform semantic clustering on code entities
   */
  async clusterEntities(
    entities: Array<{ id: string; content: string; type: NodeType; path: string }>,
    options: ClusteringOptions
  ): Promise<ClusteringResult> {
    const startTime = Date.now();
    logger.info(
      { entityCount: entities.length, algorithm: options.algorithm },
      'Starting semantic clustering'
    );

    try {
      // Filter entities if needed
      let filteredEntities = entities;
      if (options.excludeTests) {
        filteredEntities = entities.filter((e) => !this.isTestEntity(e.path));
      }

      if (filteredEntities.length === 0) {
        return this.emptyResult(options.algorithm);
      }

      // Get embeddings from GraphRAG or generate them
      const embeddings = await this.getEmbeddings(filteredEntities, options);

      // Run clustering algorithm
      let clusters: SemanticCluster[];
      switch (options.algorithm) {
        case 'kmeans':
          clusters = this.kMeansClustering(embeddings, options);
          break;
        case 'dbscan':
          clusters = this.dbscanClustering(embeddings, options);
          break;
        case 'hierarchical':
          clusters = this.hierarchicalClustering(embeddings, options);
          break;
        default:
          clusters = this.kMeansClustering(embeddings, options);
      }

      // Generate labels for clusters using AI
      clusters = await this.generateClusterLabels(clusters, embeddings);

      // Calculate positions for visualization
      this.calculateClusterPositions(clusters);

      // Calculate quality metrics
      const silhouetteScore = this.calculateSilhouetteScore(clusters, embeddings);

      // Find unclustered entities
      const clusteredIds = new Set(clusters.flatMap((c) => c.members));
      const unclustered = filteredEntities
        .filter((e) => !clusteredIds.has(e.id))
        .map((e) => e.id);

      const duration = Date.now() - startTime;
      logger.info(
        {
          clusterCount: clusters.length,
          unclusteredCount: unclustered.length,
          silhouetteScore,
          duration,
        },
        'Semantic clustering complete'
      );

      return {
        clusters,
        unclustered,
        silhouetteScore,
        metadata: {
          algorithm: options.algorithm,
          totalEntities: filteredEntities.length,
          totalClusters: clusters.length,
          avgClusterSize: clusters.length > 0
            ? Math.round(filteredEntities.length / clusters.length)
            : 0,
          generatedAt: new Date(),
        },
      };
    } catch (error) {
      logger.error({ error, options }, 'Failed to cluster entities');
      throw new Error(
        `Semantic clustering failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get embeddings for entities
   */
  private async getEmbeddings(
    entities: Array<{ id: string; content: string; type: NodeType; path: string }>,
    options: ClusteringOptions
  ): Promise<Map<string, { entity: typeof entities[0]; embedding: number[] }>> {
    const embeddings = new Map<string, { entity: typeof entities[0]; embedding: number[] }>();

    if (options.useGraphRAGEmbeddings) {
      // Query GraphRAG for embeddings
      for (const entity of entities) {
        try {
          const results = await this.graphRAGClient.search(entity.content.substring(0, 500), {
            limit: 1,
            domain: 'code',
          });

          if (results.length > 0 && results[0].metadata.embedding) {
            embeddings.set(entity.id, {
              entity,
              embedding: results[0].metadata.embedding as number[],
            });
          } else {
            // Generate simple embedding as fallback
            embeddings.set(entity.id, {
              entity,
              embedding: this.generateSimpleEmbedding(entity.content),
            });
          }
        } catch (error) {
          logger.warn({ entityId: entity.id, error }, 'Failed to get embedding from GraphRAG');
          embeddings.set(entity.id, {
            entity,
            embedding: this.generateSimpleEmbedding(entity.content),
          });
        }
      }
    } else {
      // Generate simple embeddings locally
      for (const entity of entities) {
        embeddings.set(entity.id, {
          entity,
          embedding: this.generateSimpleEmbedding(entity.content),
        });
      }
    }

    return embeddings;
  }

  /**
   * Generate simple embedding using TF-IDF-like approach
   */
  private generateSimpleEmbedding(content: string): number[] {
    const dimensions = 64;
    const embedding = new Array(dimensions).fill(0);

    // Tokenize
    const tokens = content.toLowerCase().match(/\b\w+\b/g) || [];

    // Create vocabulary hash
    const vocab = new Map<string, number>();
    for (const token of tokens) {
      if (token.length > 2) {
        vocab.set(token, (vocab.get(token) || 0) + 1);
      }
    }

    // Generate embedding from token hashes
    for (const [token, count] of vocab) {
      const hash = this.hashString(token);
      const idx = Math.abs(hash) % dimensions;
      embedding[idx] += count * (1 + Math.log(count));
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * K-Means clustering implementation
   */
  private kMeansClustering(
    embeddings: Map<string, { entity: { id: string; content: string; type: NodeType; path: string }; embedding: number[] }>,
    options: ClusteringOptions
  ): SemanticCluster[] {
    const k = options.numClusters || Math.max(2, Math.floor(Math.sqrt(embeddings.size / 2)));
    const maxIterations = 50;
    const entities = Array.from(embeddings.values());

    if (entities.length < k) {
      return this.createSingleCluster(entities);
    }

    // Initialize centroids randomly
    const shuffled = [...entities].sort(() => Math.random() - 0.5);
    let centroids = shuffled.slice(0, k).map((e) => [...e.embedding]);

    // Iterate
    let assignments = new Map<string, number>();

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Assign entities to nearest centroid
      const newAssignments = new Map<string, number>();

      for (const item of entities) {
        let minDist = Infinity;
        let nearestCluster = 0;

        for (let c = 0; c < k; c++) {
          const dist = this.euclideanDistance(item.embedding, centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            nearestCluster = c;
          }
        }

        newAssignments.set(item.entity.id, nearestCluster);
      }

      // Check for convergence
      let changed = false;
      for (const [id, cluster] of newAssignments) {
        if (assignments.get(id) !== cluster) {
          changed = true;
          break;
        }
      }

      assignments = newAssignments;

      if (!changed) break;

      // Update centroids
      const dimensions = entities[0].embedding.length;
      const newCentroids: number[][] = Array(k).fill(null).map(() => new Array(dimensions).fill(0));
      const counts = new Array(k).fill(0);

      for (const item of entities) {
        const cluster = assignments.get(item.entity.id)!;
        counts[cluster]++;
        for (let d = 0; d < dimensions; d++) {
          newCentroids[cluster][d] += item.embedding[d];
        }
      }

      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
          for (let d = 0; d < dimensions; d++) {
            newCentroids[c][d] /= counts[c];
          }
        }
      }

      centroids = newCentroids;
    }

    // Build clusters from assignments
    const clusterGroups = new Map<number, typeof entities>();

    for (const item of entities) {
      const cluster = assignments.get(item.entity.id)!;
      if (!clusterGroups.has(cluster)) {
        clusterGroups.set(cluster, []);
      }
      clusterGroups.get(cluster)!.push(item);
    }

    return this.buildClustersFromGroups(clusterGroups, centroids);
  }

  /**
   * DBSCAN clustering implementation
   */
  private dbscanClustering(
    embeddings: Map<string, { entity: { id: string; content: string; type: NodeType; path: string }; embedding: number[] }>,
    options: ClusteringOptions
  ): SemanticCluster[] {
    const epsilon = options.epsilon || 0.5;
    const minPoints = options.minClusterSize || 3;
    const entities = Array.from(embeddings.values());

    const labels = new Map<string, number>(); // -1 = noise, 0+ = cluster
    let currentCluster = 0;

    const getNeighbors = (idx: number): number[] => {
      const neighbors: number[] = [];
      for (let i = 0; i < entities.length; i++) {
        if (i !== idx) {
          const dist = this.euclideanDistance(entities[idx].embedding, entities[i].embedding);
          if (dist <= epsilon) {
            neighbors.push(i);
          }
        }
      }
      return neighbors;
    };

    const expandCluster = (idx: number, neighbors: number[], cluster: number): void => {
      labels.set(entities[idx].entity.id, cluster);
      const queue = [...neighbors];
      const visited = new Set<number>([idx]);

      while (queue.length > 0) {
        const neighborIdx = queue.shift()!;
        if (visited.has(neighborIdx)) continue;
        visited.add(neighborIdx);

        const neighborId = entities[neighborIdx].entity.id;

        if (labels.get(neighborId) === -1) {
          labels.set(neighborId, cluster);
        }

        if (!labels.has(neighborId)) {
          labels.set(neighborId, cluster);
          const neighborNeighbors = getNeighbors(neighborIdx);
          if (neighborNeighbors.length >= minPoints) {
            queue.push(...neighborNeighbors);
          }
        }
      }
    };

    // Run DBSCAN
    for (let i = 0; i < entities.length; i++) {
      const id = entities[i].entity.id;
      if (labels.has(id)) continue;

      const neighbors = getNeighbors(i);
      if (neighbors.length < minPoints) {
        labels.set(id, -1); // Noise
      } else {
        expandCluster(i, neighbors, currentCluster);
        currentCluster++;
      }
    }

    // Build clusters
    const clusterGroups = new Map<number, typeof entities>();

    for (const item of entities) {
      const cluster = labels.get(item.entity.id)!;
      if (cluster === -1) continue; // Skip noise

      if (!clusterGroups.has(cluster)) {
        clusterGroups.set(cluster, []);
      }
      clusterGroups.get(cluster)!.push(item);
    }

    // Calculate centroids
    const centroids: number[][] = [];
    for (const [_, group] of clusterGroups) {
      centroids.push(this.calculateCentroid(group.map((g) => g.embedding)));
    }

    return this.buildClustersFromGroups(clusterGroups, centroids);
  }

  /**
   * Hierarchical clustering implementation (agglomerative)
   */
  private hierarchicalClustering(
    embeddings: Map<string, { entity: { id: string; content: string; type: NodeType; path: string }; embedding: number[] }>,
    options: ClusteringOptions
  ): SemanticCluster[] {
    const targetClusters = options.numClusters || Math.max(2, Math.floor(Math.sqrt(embeddings.size / 2)));
    const entities = Array.from(embeddings.values());

    // Start with each entity as its own cluster
    let clusters: Array<{ members: typeof entities; centroid: number[] }> = entities.map((e) => ({
      members: [e],
      centroid: [...e.embedding],
    }));

    // Merge until we reach target number
    while (clusters.length > targetClusters) {
      // Find closest pair
      let minDist = Infinity;
      let mergeI = 0;
      let mergeJ = 1;

      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const dist = this.euclideanDistance(clusters[i].centroid, clusters[j].centroid);
          if (dist < minDist) {
            minDist = dist;
            mergeI = i;
            mergeJ = j;
          }
        }
      }

      // Merge clusters
      const merged = {
        members: [...clusters[mergeI].members, ...clusters[mergeJ].members],
        centroid: this.calculateCentroid([
          ...clusters[mergeI].members.map((m) => m.embedding),
          ...clusters[mergeJ].members.map((m) => m.embedding),
        ]),
      };

      clusters = clusters.filter((_, idx) => idx !== mergeI && idx !== mergeJ);
      clusters.push(merged);
    }

    // Convert to cluster groups
    const clusterGroups = new Map<number, typeof entities>();
    const centroids: number[][] = [];

    clusters.forEach((cluster, idx) => {
      clusterGroups.set(idx, cluster.members);
      centroids.push(cluster.centroid);
    });

    return this.buildClustersFromGroups(clusterGroups, centroids);
  }

  /**
   * Build cluster objects from groups
   */
  private buildClustersFromGroups(
    groups: Map<number, Array<{ entity: { id: string; content: string; type: NodeType; path: string }; embedding: number[] }>>,
    centroids: number[][]
  ): SemanticCluster[] {
    const clusters: SemanticCluster[] = [];
    let idx = 0;

    for (const [_, members] of groups) {
      if (members.length === 0) continue;

      // Calculate cohesion
      const centroid = centroids[idx] || this.calculateCentroid(members.map((m) => m.embedding));
      const avgDist = members.reduce(
        (sum, m) => sum + this.euclideanDistance(m.embedding, centroid),
        0
      ) / members.length;
      const cohesion = 1 / (1 + avgDist);

      // Find dominant type
      const typeCounts = new Map<NodeType, number>();
      for (const m of members) {
        typeCounts.set(m.entity.type, (typeCounts.get(m.entity.type) || 0) + 1);
      }
      const dominantType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'function';

      // Extract keywords
      const keywords = this.extractKeywords(members.map((m) => m.entity.content));

      clusters.push({
        id: `cluster-${idx}`,
        label: `Cluster ${idx + 1}`,
        description: '', // Will be filled by AI
        members: members.map((m) => m.entity.id),
        centroid,
        cohesion,
        keywords,
        dominantType,
        color: this.getClusterColor(idx),
      });

      idx++;
    }

    return clusters;
  }

  /**
   * Generate cluster labels using AI
   */
  private async generateClusterLabels(
    clusters: SemanticCluster[],
    embeddings: Map<string, { entity: { id: string; content: string; type: NodeType; path: string }; embedding: number[] }>
  ): Promise<SemanticCluster[]> {
    if (!this.mageAgentClient) {
      // Generate simple labels from keywords
      return clusters.map((cluster) => ({
        ...cluster,
        label: cluster.keywords.slice(0, 3).join(', ') || `${cluster.dominantType} cluster`,
        description: `Contains ${cluster.members.length} ${cluster.dominantType}(s) with keywords: ${cluster.keywords.slice(0, 5).join(', ')}`,
      }));
    }

    // Use AI to generate labels
    for (const cluster of clusters) {
      try {
        const sampleContent = cluster.members
          .slice(0, 3)
          .map((id) => embeddings.get(id)?.entity.content.substring(0, 200))
          .filter(Boolean)
          .join('\n---\n');

        const prompt = `Generate a short descriptive label (2-4 words) and a one-sentence description for this code cluster:

Keywords: ${cluster.keywords.join(', ')}
Dominant type: ${cluster.dominantType}

Sample code snippets:
${sampleContent}

Format: LABEL: [label] DESCRIPTION: [description]`;

        const job = await this.mageAgentClient.orchestrate(prompt, {
          maxAgents: 1,
          timeout: 10000,
        });

        // Wait for job completion and get result
        const jobResult = await this.mageAgentClient.waitForCompletion(job.jobId, 1000, 10000);
        const resultText = (jobResult.result as string) || '';

        const labelMatch = resultText.match(/LABEL:\s*(.+?)(?:\s+DESCRIPTION:|$)/i);
        const descMatch = resultText.match(/DESCRIPTION:\s*(.+)/i);

        if (labelMatch) cluster.label = labelMatch[1].trim();
        if (descMatch) cluster.description = descMatch[1].trim();
      } catch (error) {
        logger.warn({ clusterId: cluster.id, error }, 'Failed to generate AI label');
        cluster.label = cluster.keywords.slice(0, 3).join(', ') || `${cluster.dominantType} cluster`;
        cluster.description = `Contains ${cluster.members.length} ${cluster.dominantType}(s)`;
      }
    }

    return clusters;
  }

  /**
   * Calculate cluster positions for visualization
   */
  private calculateClusterPositions(clusters: SemanticCluster[]): void {
    const gridSize = Math.ceil(Math.sqrt(clusters.length));
    const cellWidth = 800 / gridSize;
    const cellHeight = 600 / gridSize;

    clusters.forEach((cluster, idx) => {
      const row = Math.floor(idx / gridSize);
      const col = idx % gridSize;

      cluster.position = {
        x: col * cellWidth + cellWidth / 2,
        y: row * cellHeight + cellHeight / 2,
      };
    });
  }

  /**
   * Calculate silhouette score
   */
  private calculateSilhouetteScore(
    clusters: SemanticCluster[],
    embeddings: Map<string, { entity: { id: string; content: string; type: NodeType; path: string }; embedding: number[] }>
  ): number {
    if (clusters.length <= 1) return 0;

    let totalScore = 0;
    let count = 0;

    for (const cluster of clusters) {
      for (const memberId of cluster.members) {
        const member = embeddings.get(memberId);
        if (!member) continue;

        // Calculate a (average distance to same cluster)
        let a = 0;
        for (const otherId of cluster.members) {
          if (otherId !== memberId) {
            const other = embeddings.get(otherId);
            if (other) {
              a += this.euclideanDistance(member.embedding, other.embedding);
            }
          }
        }
        a = cluster.members.length > 1 ? a / (cluster.members.length - 1) : 0;

        // Calculate b (minimum average distance to other clusters)
        let b = Infinity;
        for (const otherCluster of clusters) {
          if (otherCluster.id === cluster.id) continue;

          let avgDist = 0;
          for (const otherId of otherCluster.members) {
            const other = embeddings.get(otherId);
            if (other) {
              avgDist += this.euclideanDistance(member.embedding, other.embedding);
            }
          }
          avgDist /= otherCluster.members.length;
          b = Math.min(b, avgDist);
        }

        // Silhouette coefficient for this point
        const s = b === Infinity ? 0 : (b - a) / Math.max(a, b);
        totalScore += s;
        count++;
      }
    }

    return count > 0 ? totalScore / count : 0;
  }

  /**
   * Euclidean distance between vectors
   */
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      sum += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(sum);
  }

  /**
   * Calculate centroid of embeddings
   */
  private calculateCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];

    const dimensions = embeddings[0].length;
    const centroid = new Array(dimensions).fill(0);

    for (const embedding of embeddings) {
      for (let d = 0; d < dimensions; d++) {
        centroid[d] += embedding[d];
      }
    }

    for (let d = 0; d < dimensions; d++) {
      centroid[d] /= embeddings.length;
    }

    return centroid;
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(contents: string[]): string[] {
    const wordCounts = new Map<string, number>();
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'and', 'or', 'in', 'on', 'at', 'for', 'with', 'this', 'that', 'from', 'by', 'as', 'be', 'it', 'function', 'const', 'let', 'var', 'return', 'if', 'else', 'import', 'export', 'class', 'interface', 'type', 'async', 'await', 'new', 'null', 'undefined', 'true', 'false']);

    for (const content of contents) {
      const words = content.toLowerCase().match(/\b[a-z][a-z0-9]*\b/g) || [];
      for (const word of words) {
        if (word.length > 2 && !stopWords.has(word)) {
          wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
        }
      }
    }

    return [...wordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Get color for cluster
   */
  private getClusterColor(index: number): string {
    const colors = [
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#84cc16', // Lime
    ];
    return colors[index % colors.length];
  }

  /**
   * Check if entity is test-related
   */
  private isTestEntity(path: string): boolean {
    return (
      path.includes('.test.') ||
      path.includes('.spec.') ||
      path.includes('__tests__') ||
      path.includes('/test/')
    );
  }

  /**
   * Create single cluster for small datasets
   */
  private createSingleCluster(
    entities: Array<{ entity: { id: string; content: string; type: NodeType; path: string }; embedding: number[] }>
  ): SemanticCluster[] {
    if (entities.length === 0) return [];

    return [{
      id: 'cluster-0',
      label: 'All entities',
      description: `All ${entities.length} entities`,
      members: entities.map((e) => e.entity.id),
      centroid: this.calculateCentroid(entities.map((e) => e.embedding)),
      cohesion: 1,
      keywords: this.extractKeywords(entities.map((e) => e.entity.content)),
      dominantType: entities[0].entity.type,
      color: '#3b82f6',
    }];
  }

  /**
   * Create empty result
   */
  private emptyResult(algorithm: ClusteringAlgorithm): ClusteringResult {
    return {
      clusters: [],
      unclustered: [],
      silhouetteScore: 0,
      metadata: {
        algorithm,
        totalEntities: 0,
        totalClusters: 0,
        avgClusterSize: 0,
        generatedAt: new Date(),
      },
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createDefaultClusteringOptions(): ClusteringOptions {
  return {
    algorithm: 'kmeans',
    numClusters: undefined, // Auto-detect
    minClusterSize: 3,
    epsilon: 0.5,
    useGraphRAGEmbeddings: true,
    excludeTests: true,
  };
}
