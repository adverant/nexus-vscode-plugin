// src/visualization/evolution-timeline.ts
/**
 * NexusMind Evolution Timeline
 *
 * Visualizes how code entities change over time using git history.
 * Provides temporal insights into code development and refactoring patterns.
 */

import {
  EvolutionTimeline,
  EvolutionTimelineOptions,
  TimelineEvent,
  ChangeType,
  TimelineGranularity,
  NodeType,
} from './types.js';
import { GitService, CommitInfo } from '../git/git-service.js';
import { MageAgentClient } from '../clients/mageagent-client.js';
import { TreeSitterService } from '../parsers/tree-sitter-service.js';
import { ASTNode } from '../types.js';
import pino from 'pino';
import { readFile } from 'fs/promises';
import { join } from 'path';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// ============================================================================
// Evolution Timeline Builder
// ============================================================================

export class EvolutionTimelineBuilder {
  constructor(
    private gitService: GitService,
    private mageAgentClient: MageAgentClient | null,
    private treeSitterService: TreeSitterService,
    private repoPath: string
  ) {}

  /**
   * Build evolution timeline for a code entity
   */
  async buildTimeline(options: EvolutionTimelineOptions): Promise<EvolutionTimeline> {
    const startTime = Date.now();
    logger.info({ entity: options.entity, granularity: options.granularity }, 'Building evolution timeline');

    try {
      // Determine entity type (file or symbol)
      const isFile = options.entity.includes('.') && !options.entity.includes(':');
      const entityType: NodeType = isFile ? 'file' : await this.detectEntityType(options.entity);

      // Get commit history
      const commits = await this.getRelevantCommits(options);

      // Build timeline events
      const events = await this.buildTimelineEvents(options, commits);

      // Aggregate by granularity
      const aggregatedEvents = this.aggregateEvents(events, options.granularity);

      // Calculate statistics
      const statistics = this.calculateStatistics(aggregatedEvents);

      // Generate insights
      const insights = await this.generateInsights(options.entity, aggregatedEvents, statistics);

      const duration = Date.now() - startTime;
      logger.info(
        { eventCount: aggregatedEvents.length, duration },
        'Evolution timeline built'
      );

      return {
        entity: options.entity,
        entityType,
        events: aggregatedEvents,
        statistics,
        insights,
      };
    } catch (error) {
      logger.error({ error, options }, 'Failed to build evolution timeline');
      throw new Error(
        `Failed to build evolution timeline: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Detect entity type from name
   */
  private async detectEntityType(entity: string): Promise<NodeType> {
    // If entity contains file path separator, it's likely a symbol in a file
    if (entity.includes(':')) {
      const [filePath, symbolName] = entity.split(':');
      const absolutePath = join(this.repoPath, filePath);

      try {
        const parsed = await this.treeSitterService.parseFile(absolutePath);
        if (parsed) {
          const node = parsed.nodes.find((n) => n.name === symbolName);
          if (node) {
            return this.mapASTType(node.type);
          }
        }
      } catch {
        // Fall through to default
      }
    }

    // Default to function
    return 'function';
  }

  /**
   * Get relevant commits for the entity
   */
  private async getRelevantCommits(options: EvolutionTimelineOptions): Promise<CommitInfo[]> {
    const isFile = options.entity.includes('.') && !options.entity.includes(':');
    const filePath = isFile ? options.entity : options.entity.split(':')[0];

    // Get file history
    const commits = await this.gitService.getFileHistory(filePath, 100);

    // Filter by time range
    return commits.filter((commit) => {
      const commitDate = commit.date;
      return commitDate >= options.timeRange.start && commitDate <= options.timeRange.end;
    });
  }

  /**
   * Build timeline events from commits
   */
  private async buildTimelineEvents(
    options: EvolutionTimelineOptions,
    commits: CommitInfo[]
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    const isFile = options.entity.includes('.') && !options.entity.includes(':');
    const filePath = isFile ? options.entity : options.entity.split(':')[0];

    for (const commit of commits) {
      try {
        // Get diff for this commit
        const diff = await this.gitService.getFileDiff(
          filePath,
          `${commit.hash}^`,
          commit.hash
        );

        // If tracking a symbol, filter to relevant changes
        if (!isFile) {
          const symbolName = options.entity.split(':')[1];
          if (!diff.includes(symbolName)) {
            continue; // Skip commits that don't touch the symbol
          }
        }

        // Parse diff stats
        const { linesAdded, linesRemoved } = this.parseDiffStats(diff);

        // Detect change type
        const changeType = this.detectChangeType(diff, commit.message);

        // Calculate impact score
        const impactScore = this.calculateImpactScore(linesAdded, linesRemoved, changeType);

        // Find related entities from the diff
        const relatedEntities = this.extractRelatedEntities(diff);

        // Generate AI summary if available
        let aiSummary: string | undefined;
        if (this.mageAgentClient && options.highlightBreakingChanges) {
          aiSummary = await this.generateCommitSummary(commit, diff);
        }

        events.push({
          id: `event-${commit.hash}`,
          timestamp: commit.date,
          commitHash: commit.hash,
          author: commit.author,
          authorEmail: commit.email,
          changeType,
          linesAdded,
          linesRemoved,
          impactScore,
          relatedEntities,
          message: commit.message,
          aiSummary,
        });
      } catch (error) {
        logger.warn({ commit: commit.hash, error }, 'Failed to process commit');
      }
    }

    return events;
  }

  /**
   * Parse diff to extract line statistics
   */
  private parseDiffStats(diff: string): { linesAdded: number; linesRemoved: number } {
    let linesAdded = 0;
    let linesRemoved = 0;

    for (const line of diff.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        linesAdded++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        linesRemoved++;
      }
    }

    return { linesAdded, linesRemoved };
  }

  /**
   * Detect change type from diff and commit message
   */
  private detectChangeType(diff: string, message: string): ChangeType {
    const messageLower = message.toLowerCase();

    // Check for creation
    if (diff.includes('new file mode') || messageLower.includes('create') || messageLower.includes('add')) {
      return 'created';
    }

    // Check for deletion
    if (diff.includes('deleted file mode') || messageLower.includes('remove') || messageLower.includes('delete')) {
      return 'deleted';
    }

    // Check for rename
    if (diff.includes('rename from') || messageLower.includes('rename') || messageLower.includes('move')) {
      return 'renamed';
    }

    // Check for refactoring
    if (messageLower.includes('refactor') || messageLower.includes('restructure')) {
      return 'refactored';
    }

    // Default to modified
    return 'modified';
  }

  /**
   * Calculate impact score based on change metrics
   */
  private calculateImpactScore(
    linesAdded: number,
    linesRemoved: number,
    changeType: ChangeType
  ): number {
    let score = 0;

    // Base score from lines changed
    const totalLines = linesAdded + linesRemoved;
    score += Math.min(totalLines * 0.5, 50);

    // Bonus for significant changes
    if (changeType === 'created') score += 20;
    if (changeType === 'deleted') score += 30;
    if (changeType === 'refactored') score += 25;

    // Churn ratio (high churn = more impact)
    if (linesAdded > 0 && linesRemoved > 0) {
      const churnRatio = Math.min(linesAdded, linesRemoved) / Math.max(linesAdded, linesRemoved);
      score += churnRatio * 20;
    }

    return Math.min(Math.round(score), 100);
  }

  /**
   * Extract related entities from diff
   */
  private extractRelatedEntities(diff: string): string[] {
    const entities: Set<string> = new Set();

    // Match function/class definitions
    const patterns = [
      /(?:function|class|interface|type)\s+(\w+)/g,
      /(?:const|let|var)\s+(\w+)\s*=/g,
      /(?:export\s+(?:default\s+)?(?:function|class|const))\s+(\w+)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(diff)) !== null) {
        entities.add(match[1]);
      }
    }

    return Array.from(entities).slice(0, 10);
  }

  /**
   * Generate AI summary for a commit
   */
  private async generateCommitSummary(commit: CommitInfo, diff: string): Promise<string | undefined> {
    if (!this.mageAgentClient) return undefined;

    try {
      const prompt = `Summarize this code change in one sentence:

Commit: ${commit.message}
Author: ${commit.author}

Diff (truncated):
${diff.substring(0, 2000)}`;

      const job = await this.mageAgentClient.orchestrate(prompt, {
        maxAgents: 1,
        timeout: 10000,
      });

      // Wait for job completion and get result
      const result = await this.mageAgentClient.waitForCompletion(job.jobId, 1000, 10000);
      return result.result as string | undefined;
    } catch (error) {
      logger.warn({ error }, 'Failed to generate AI summary');
      return undefined;
    }
  }

  /**
   * Aggregate events by granularity
   */
  private aggregateEvents(events: TimelineEvent[], granularity: TimelineGranularity): TimelineEvent[] {
    if (granularity === 'commit') {
      return events;
    }

    // Group events by time bucket
    const buckets = new Map<string, TimelineEvent[]>();

    for (const event of events) {
      const bucketKey = this.getBucketKey(event.timestamp, granularity);
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(event);
    }

    // Aggregate each bucket into a single event
    const aggregated: TimelineEvent[] = [];

    for (const [bucketKey, bucketEvents] of buckets) {
      if (bucketEvents.length === 0) continue;

      const firstEvent = bucketEvents[0];
      const totalAdded = bucketEvents.reduce((sum, e) => sum + e.linesAdded, 0);
      const totalRemoved = bucketEvents.reduce((sum, e) => sum + e.linesRemoved, 0);
      const avgImpact = bucketEvents.reduce((sum, e) => sum + e.impactScore, 0) / bucketEvents.length;
      const allEntities = bucketEvents.flatMap((e) => e.relatedEntities);
      const uniqueEntities = [...new Set(allEntities)];

      // Determine dominant change type
      const typeCounts = new Map<ChangeType, number>();
      for (const e of bucketEvents) {
        typeCounts.set(e.changeType, (typeCounts.get(e.changeType) || 0) + 1);
      }
      const dominantType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

      aggregated.push({
        id: `aggregated-${bucketKey}`,
        timestamp: firstEvent.timestamp,
        commitHash: bucketEvents.map((e) => e.commitHash).join(','),
        author: [...new Set(bucketEvents.map((e) => e.author))].join(', '),
        changeType: dominantType,
        linesAdded: totalAdded,
        linesRemoved: totalRemoved,
        impactScore: Math.round(avgImpact),
        relatedEntities: uniqueEntities.slice(0, 10),
        message: `${bucketEvents.length} commits: ${bucketEvents.map((e) => e.message).slice(0, 3).join('; ')}`,
        aiSummary: bucketEvents.find((e) => e.aiSummary)?.aiSummary,
      });
    }

    return aggregated.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get bucket key for time aggregation
   */
  private getBucketKey(date: Date, granularity: TimelineGranularity): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (granularity) {
      case 'day':
        return `${year}-${month}-${day}`;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
      case 'month':
        return `${year}-${month}`;
      default:
        return date.toISOString();
    }
  }

  /**
   * Calculate timeline statistics
   */
  private calculateStatistics(events: TimelineEvent[]): EvolutionTimeline['statistics'] {
    if (events.length === 0) {
      return {
        totalCommits: 0,
        totalAuthors: 0,
        totalLinesAdded: 0,
        totalLinesRemoved: 0,
        averageChangeSize: 0,
        mostActiveAuthor: 'N/A',
        mostActiveDay: 'N/A',
      };
    }

    const authors = new Map<string, number>();
    const days = new Map<string, number>();
    let totalAdded = 0;
    let totalRemoved = 0;

    for (const event of events) {
      totalAdded += event.linesAdded;
      totalRemoved += event.linesRemoved;

      // Count by author
      const authorKey = event.author.split(',')[0].trim();
      authors.set(authorKey, (authors.get(authorKey) || 0) + 1);

      // Count by day of week
      const dayOfWeek = event.timestamp.toLocaleDateString('en-US', { weekday: 'long' });
      days.set(dayOfWeek, (days.get(dayOfWeek) || 0) + 1);
    }

    const mostActiveAuthor = [...authors.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const mostActiveDay = [...days.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      totalCommits: events.length,
      totalAuthors: authors.size,
      totalLinesAdded: totalAdded,
      totalLinesRemoved: totalRemoved,
      averageChangeSize: Math.round((totalAdded + totalRemoved) / events.length),
      mostActiveAuthor,
      mostActiveDay,
    };
  }

  /**
   * Generate insights from timeline data
   */
  private async generateInsights(
    entity: string,
    events: TimelineEvent[],
    statistics: EvolutionTimeline['statistics']
  ): Promise<string[]> {
    const insights: string[] = [];

    // Stability insight
    if (events.length === 0) {
      insights.push(`\`${entity}\` has been stable with no changes in the selected time range.`);
    } else if (events.length > 20) {
      insights.push(`\`${entity}\` is highly active with ${events.length} change events, indicating ongoing development.`);
    } else {
      insights.push(`\`${entity}\` has ${events.length} change event(s) in its history.`);
    }

    // Authorship insight
    if (statistics.totalAuthors === 1) {
      insights.push(`Single author (${statistics.mostActiveAuthor}) has maintained this code.`);
    } else if (statistics.totalAuthors > 3) {
      insights.push(`${statistics.totalAuthors} different contributors, with ${statistics.mostActiveAuthor} being most active.`);
    }

    // Change pattern insight
    const recentEvents = events.slice(-5);
    const refactorEvents = recentEvents.filter((e) => e.changeType === 'refactored');
    if (refactorEvents.length > 0) {
      insights.push('Recent refactoring activity detected - code is being actively improved.');
    }

    // Churn insight
    const avgChurn = statistics.averageChangeSize;
    if (avgChurn > 100) {
      insights.push(`High churn rate (avg ${avgChurn} lines/change) - consider reviewing for complexity.`);
    } else if (avgChurn < 10 && events.length > 5) {
      insights.push('Small, incremental changes indicate good development practices.');
    }

    // Activity pattern
    insights.push(`Most active on ${statistics.mostActiveDay}s.`);

    return insights;
  }

  /**
   * Map AST type to NodeType
   */
  private mapASTType(astType: string): NodeType {
    switch (astType) {
      case 'class':
        return 'class';
      case 'function':
      case 'method':
        return 'function';
      case 'interface':
        return 'interface';
      default:
        return 'function';
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createDefaultTimelineOptions(entity: string): EvolutionTimelineOptions {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(now.getMonth() - 3);

  return {
    entity,
    timeRange: {
      start: threeMonthsAgo,
      end: now,
    },
    granularity: 'day',
    showAuthors: true,
    highlightBreakingChanges: true,
  };
}
