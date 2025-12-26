import * as vscode from 'vscode';
import { GraphRAGClient } from '../clients/graphrag-client';

export class NexusMindViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> =
    new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(
    private context: vscode.ExtensionContext,
    private client: GraphRAGClient
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      const item = new vscode.TreeItem('Coming Soon', vscode.TreeItemCollapsibleState.None);
      item.description = 'NexusMind visualization';
      item.iconPath = new vscode.ThemeIcon('graph');
      return [item];
    }
    return [];
  }
}
