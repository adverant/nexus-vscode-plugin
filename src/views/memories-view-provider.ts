import * as vscode from 'vscode';
import { GraphRAGClient, Memory } from '../clients/graphrag-client';

export class MemoriesViewProvider implements vscode.TreeDataProvider<MemoryTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<MemoryTreeItem | undefined | null | void> =
    new vscode.EventEmitter<MemoryTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<MemoryTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(
    private context: vscode.ExtensionContext,
    private client: GraphRAGClient
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: MemoryTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: MemoryTreeItem): Promise<MemoryTreeItem[]> {
    if (!element) {
      // Root level - show memories
      try {
        const result = await this.client.listMemories(10, 0);
        return result.memories.map(m => new MemoryTreeItem(m));
      } catch (error) {
        return [];
      }
    }
    return [];
  }
}

class MemoryTreeItem extends vscode.TreeItem {
  constructor(public readonly memory: Memory) {
    super(memory.content.substring(0, 50) + '...', vscode.TreeItemCollapsibleState.None);

    this.tooltip = memory.content;
    this.description = memory.tags.join(', ');
    this.contextValue = 'memory';
    this.iconPath = new vscode.ThemeIcon('file-code');
  }
}
