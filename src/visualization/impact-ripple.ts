// src/visualization/impact-ripple.ts
/**
 * NexusMind Impact Ripple Visualization
 *
 * Visualizes the ripple effect of changes to a code entity.
 * Shows concentric rings of dependent code with severity indicators.
 */

import {
  ImpactRipple,
  ImpactRippleOptions,
  RippleLayer,
  RippleNode,
  ImpactSeverity,
  NodeType,
  EdgeType,
  Position,
} from './types.js';
import { ImpactAnalysisHandler, ImpactItem, ImpactLevel } from '../handlers/impact-analysis.js';
import { GraphRAGClient } from '../clients/graphrag-client.js';
import { TreeSitterService } from '../parsers/tree-sitter-service.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============================================================================
// Impact Ripple Builder
// ============================================================================

export class ImpactRippleBuilder {
  private impactAnalysisHandler: ImpactAnalysisHandler;

  constructor(
    graphRAGClient: GraphRAGClient,
    treeSitterService: TreeSitterService,
    private repoPath: string
  ) {
    this.impactAnalysisHandler = new ImpactAnalysisHandler(
      graphRAGClient,
      treeSitterService,
      repoPath
    );
  }

  /**
   * Build impact ripple visualization for an entity
   */
  async buildRipple(options: ImpactRippleOptions): Promise<ImpactRipple> {
    const startTime = Date.now();
    logger.info({ entityId: options.entityId, maxDepth: options.maxDepth }, 'Building impact ripple');

    try {
      // Parse entity ID to get symbol and file
      const { symbol, filePath } = this.parseEntityId(options.entityId);

      // Run impact analysis
      const analysisResult = await this.impactAnalysisHandler.analyzeImpact(symbol, filePath);

      // Convert impacts to ripple layers
      const layers = this.buildRippleLayers(analysisResult.impacts, options);

      // Calculate positions for visualization
      this.calculateRipplePositions(layers);

      // Count by severity
      const counts = this.countBySeverity(layers);

      const duration = Date.now() - startTime;
      logger.info(
        {
          layerCount: layers.length,
          totalAffected: counts.total,
          duration,
        },
        'Impact ripple built'
      );

      return {
        sourceEntity: {
          id: options.entityId,
          name: symbol,
          filePath: filePath || analysisResult.targetFile,
          type: 'function', // Default, could be detected
        },
        layers,
        totalAffected: counts.total,
        criticalCount: counts.critical,
        highCount: counts.high,
        mediumCount: counts.medium,
        lowCount: counts.low,
        animationData: {
          pulseSpeed: 1.5,
          colors: {
            critical: '#ef4444',
            high: '#f97316',
            medium: '#eab308',
            low: '#22c55e',
            none: '#64748b',
          },
        },
      };
    } catch (error) {
      logger.error({ error, options }, 'Failed to build impact ripple');
      throw new Error(
        `Failed to build impact ripple: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse entity ID into symbol and file path
   */
  private parseEntityId(entityId: string): { symbol: string; filePath?: string } {
    // Format: "file:path/to/file.ts:SymbolName" or just "SymbolName"
    if (entityId.includes(':')) {
      const parts = entityId.split(':');
      if (parts.length >= 3) {
        // file:path:symbol
        return {
          filePath: parts.slice(1, -1).join(':'),
          symbol: parts[parts.length - 1],
        };
      } else if (parts.length === 2) {
        // path:symbol or type:path
        if (parts[0].includes('.') || parts[0].includes('/')) {
          return { filePath: parts[0], symbol: parts[1] };
        } else {
          return { symbol: parts[1] };
        }
      }
    }
    return { symbol: entityId };
  }

  /**
   * Build ripple layers from impact analysis results
   */
  private buildRippleLayers(impacts: ImpactItem[], options: ImpactRippleOptions): RippleLayer[] {
    // Group impacts by depth
    const depthGroups = new Map<number, ImpactItem[]>();

    for (const impact of impacts) {
      // Filter by options
      if (!options.includeTests && this.isTestFile(impact.filePath)) {
        continue;
      }
      if (impact.impactScore < options.minimumImpactScore) {
        continue;
      }
      if (impact.depth > options.maxDepth) {
        continue;
      }

      if (!depthGroups.has(impact.depth)) {
        depthGroups.set(impact.depth, []);
      }
      depthGroups.get(impact.depth)!.push(impact);
    }

    // Convert to ripple layers
    const layers: RippleLayer[] = [];

    for (const [depth, groupImpacts] of depthGroups) {
      const nodes: RippleNode[] = groupImpacts.map((impact) => {
        const severity = this.mapImpactLevelToSeverity(impact.impactLevel);
        const usageTypes = this.extractUsageTypes(impact);

        return {
          id: `ripple-${depth}-${impact.filePath}-${impact.symbol}`,
          name: impact.symbol,
          filePath: impact.filePath,
          depth: impact.depth,
          severity,
          impactScore: impact.impactScore,
          usageCount: impact.usages.length,
          usageTypes,
        };
      });

      // Calculate layer severity (worst case)
      const layerSeverity = this.calculateLayerSeverity(nodes);
      const totalImpact = nodes.reduce((sum, n) => sum + n.impactScore, 0);

      layers.push({
        depth,
        severity: layerSeverity,
        nodes,
        totalImpact,
      });
    }

    // Sort layers by depth
    layers.sort((a, b) => a.depth - b.depth);

    return layers;
  }

  /**
   * Calculate positions for ripple nodes (radial layout)
   */
  private calculateRipplePositions(layers: RippleLayer[]): void {
    const centerX = 400;
    const centerY = 400;
    const baseRadius = 100;
    const radiusStep = 80;

    for (const layer of layers) {
      const radius = baseRadius + (layer.depth - 1) * radiusStep;
      const nodeCount = layer.nodes.length;

      layer.nodes.forEach((node, index) => {
        const angle = (2 * Math.PI * index) / nodeCount - Math.PI / 2;
        node.angle = angle;
        node.radius = radius;
        node.position = {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        };
      });
    }
  }

  /**
   * Map ImpactLevel to ImpactSeverity
   */
  private mapImpactLevelToSeverity(level: ImpactLevel): ImpactSeverity {
    switch (level) {
      case 'CRITICAL':
        return 'critical';
      case 'HIGH':
        return 'high';
      case 'MEDIUM':
        return 'medium';
      case 'LOW':
        return 'low';
      default:
        return 'none';
    }
  }

  /**
   * Extract usage types from impact item
   */
  private extractUsageTypes(impact: ImpactItem): EdgeType[] {
    const types = new Set<EdgeType>();

    for (const usage of impact.usages) {
      switch (usage.usageType) {
        case 'call':
          types.add('calls');
          break;
        case 'import':
          types.add('imports');
          break;
        case 'inheritance':
          types.add('extends');
          break;
        case 'reference':
          types.add('references');
          break;
      }
    }

    return Array.from(types);
  }

  /**
   * Calculate overall severity for a layer
   */
  private calculateLayerSeverity(nodes: RippleNode[]): ImpactSeverity {
    const severityOrder: ImpactSeverity[] = ['critical', 'high', 'medium', 'low', 'none'];

    for (const severity of severityOrder) {
      if (nodes.some((n) => n.severity === severity)) {
        return severity;
      }
    }

    return 'none';
  }

  /**
   * Count nodes by severity
   */
  private countBySeverity(layers: RippleLayer[]): {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  } {
    let total = 0;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    for (const layer of layers) {
      for (const node of layer.nodes) {
        total++;
        switch (node.severity) {
          case 'critical':
            critical++;
            break;
          case 'high':
            high++;
            break;
          case 'medium':
            medium++;
            break;
          case 'low':
            low++;
            break;
        }
      }
    }

    return { total, critical, high, medium, low };
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(filePath: string): boolean {
    return (
      filePath.includes('.test.') ||
      filePath.includes('.spec.') ||
      filePath.includes('__tests__') ||
      filePath.includes('/test/')
    );
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createDefaultRippleOptions(entityId: string): ImpactRippleOptions {
  return {
    entityId,
    maxDepth: 3,
    includeTests: false,
    minimumImpactScore: 10,
  };
}

/**
 * Generate ripple animation keyframes for visualization
 */
export function generateRippleAnimation(
  layers: RippleLayer[],
  durationMs: number = 2000
): Array<{
  layer: number;
  startTime: number;
  endTime: number;
  opacity: number;
}> {
  const keyframes: Array<{
    layer: number;
    startTime: number;
    endTime: number;
    opacity: number;
  }> = [];

  const layerDuration = durationMs / (layers.length + 1);

  for (let i = 0; i < layers.length; i++) {
    const startTime = i * layerDuration;
    const peakTime = startTime + layerDuration / 2;
    const endTime = durationMs;

    keyframes.push({
      layer: layers[i].depth,
      startTime,
      endTime,
      opacity: 1,
    });
  }

  return keyframes;
}

/**
 * Calculate severity color based on impact score
 */
export function getSeverityColor(severity: ImpactSeverity): string {
  const colors: Record<ImpactSeverity, string> = {
    critical: '#ef4444', // Red
    high: '#f97316', // Orange
    medium: '#eab308', // Yellow
    low: '#22c55e', // Green
    none: '#64748b', // Gray
  };
  return colors[severity];
}

/**
 * Calculate opacity based on depth
 */
export function getDepthOpacity(depth: number, maxDepth: number): number {
  return 1 - (depth - 1) * (0.6 / maxDepth);
}
