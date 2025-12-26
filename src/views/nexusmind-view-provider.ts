import * as vscode from 'vscode';
import { GraphRAGClient } from '../clients/graphrag-client';

export class NexusMindViewProvider implements vscode.TreeDataProvider<ActionItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ActionItem | undefined | null | void> =
    new vscode.EventEmitter<ActionItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<ActionItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(
    private context: vscode.ExtensionContext,
    private client: GraphRAGClient
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ActionItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ActionItem): Promise<ActionItem[]> {
    if (!element) {
      // Root level - show action categories
      return [
        new ActionItem('🔍 Code Intelligence', 'code-intelligence', vscode.TreeItemCollapsibleState.Expanded),
        new ActionItem('🎨 Visualizations', 'visualizations', vscode.TreeItemCollapsibleState.Expanded),
        new ActionItem('🔒 Security & Testing', 'security', vscode.TreeItemCollapsibleState.Expanded),
      ];
    }

    // Child items based on category
    switch (element.contextValue) {
      case 'code-intelligence':
        return [
          new ActionItem('📝 Explain Selected Code', 'nexus.explainCode', vscode.TreeItemCollapsibleState.None, 'lightbulb'),
          new ActionItem('💥 Analyze Impact', 'nexus.impactAnalysis', vscode.TreeItemCollapsibleState.None, 'debug-stackframe'),
          new ActionItem('📚 Query Knowledge Graph', 'nexus.queryKnowledgeGraph', vscode.TreeItemCollapsibleState.None, 'search'),
          new ActionItem('📜 Show File History', 'nexus.fileHistory', vscode.TreeItemCollapsibleState.None, 'history'),
        ];

      case 'visualizations':
        return [
          new ActionItem('🕸️ Dependency Graph', 'nexus.dependencyGraph', vscode.TreeItemCollapsibleState.None, 'graph'),
          new ActionItem('⏱️ Evolution Timeline', 'nexus.evolutionTimeline', vscode.TreeItemCollapsibleState.None, 'timeline'),
          new ActionItem('💫 Impact Ripple', 'nexus.impactRipple', vscode.TreeItemCollapsibleState.None, 'target'),
          new ActionItem('🎯 Semantic Clusters', 'nexus.semanticClusters', vscode.TreeItemCollapsibleState.None, 'symbol-color'),
          new ActionItem('🏗️ Architecture Analysis', 'nexus.architectureAnalyze', vscode.TreeItemCollapsibleState.None, 'organization'),
          new ActionItem('💬 Natural Language Query', 'nexus.nlQuery', vscode.TreeItemCollapsibleState.None, 'comment-discussion'),
        ];

      case 'security':
        return [
          new ActionItem('🔒 Security Scan', 'nexus.securityScan', vscode.TreeItemCollapsibleState.None, 'shield'),
          new ActionItem('🧪 Generate Tests', 'nexus.generateTests', vscode.TreeItemCollapsibleState.None, 'beaker'),
        ];
    }

    return [];
  }
}

class ActionItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly contextValue: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    iconName?: string
  ) {
    super(label, collapsibleState);

    // If this is a command (not a category), make it clickable
    if (contextValue.startsWith('nexus.')) {
      this.command = {
        command: contextValue,
        title: label,
      };
      this.tooltip = `Click to ${label.replace(/^[🔍🎨🔒📝💥📚📜🕸️⏱️💫🎯🏗️💬🔒🧪]+\s*/, '')}`;
    }

    if (iconName) {
      this.iconPath = new vscode.ThemeIcon(iconName);
    }
  }
}
