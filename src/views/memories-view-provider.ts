import * as vscode from 'vscode';
import { GraphRAGClient, SearchResult } from '../clients/graphrag-client';

export class MemoriesViewProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | null | void> =
    new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(
    private context: vscode.ExtensionContext,
    private client: GraphRAGClient
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      // Root level - show quick actions and recent memories
      const items: TreeNode[] = [];

      // Quick Actions section
      items.push(new CategoryNode('⚡ Quick Actions'));
      items.push(new ActionNode('💾 Store Memory', 'nexus.storeMemory', 'Save selected code'));
      items.push(new ActionNode('🔍 Recall Memory', 'nexus.recallMemory', 'Search memories'));
      items.push(new ActionNode('⚙️ Configure API', 'nexus.configure', 'Set up API key'));
      items.push(new ActionNode('📦 Index Repository', 'nexus.indexRepository', 'Build knowledge graph'));

      // Recent Memories section
      items.push(new CategoryNode('📚 Recent Memories'));

      try {
        const results = await this.client.search('', { limit: 5, domain: 'code' });
        if (results.length > 0) {
          results.forEach(r => items.push(new MemoryNode(r)));
        } else {
          items.push(new InfoNode('No memories stored yet', 'Store code with Cmd+Shift+P → Store Memory'));
        }
      } catch (error) {
        items.push(new InfoNode('⚠️ Not configured', 'Click "Configure API" above'));
      }

      return items;
    }
    return [];
  }
}

// Category header (not clickable)
class CategoryNode extends vscode.TreeItem {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'category';
  }
}

// Action button (clickable command)
class ActionNode extends vscode.TreeItem {
  constructor(
    label: string,
    commandId: string,
    tooltip: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = {
      command: commandId,
      title: label,
    };
    this.tooltip = tooltip;
    this.contextValue = 'action';

    // Set icon based on command
    const iconMap: Record<string, string> = {
      'nexus.storeMemory': 'save',
      'nexus.recallMemory': 'search',
      'nexus.configure': 'gear',
      'nexus.indexRepository': 'database',
    };

    const iconName = iconMap[commandId];
    if (iconName) {
      this.iconPath = new vscode.ThemeIcon(iconName);
    }
  }
}

// Info item (not clickable)
class InfoNode extends vscode.TreeItem {
  constructor(label: string, description: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.contextValue = 'info';
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

// Memory item (shows stored memory)
class MemoryNode extends vscode.TreeItem {
  constructor(public readonly result: SearchResult) {
    super(result.content.substring(0, 50) + '...', vscode.TreeItemCollapsibleState.None);

    this.tooltip = result.content;
    this.description = `Score: ${(result.score * 100).toFixed(1)}%`;
    this.contextValue = 'memory';
    this.iconPath = new vscode.ThemeIcon('file-code');

    // Make it clickable to view full content
    this.command = {
      command: 'nexus.viewMemory',
      title: 'View Memory',
      arguments: [result],
    };
  }
}

type TreeNode = CategoryNode | ActionNode | InfoNode | MemoryNode;
