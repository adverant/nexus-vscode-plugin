import * as vscode from 'vscode';
import * as path from 'path';
import { MessageRouter } from './MessageRouter';
import { Request, Response } from './types';

export class WebViewPanelManager {
  private static instance: WebViewPanelManager | undefined;
  private panel: vscode.WebviewPanel | undefined;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    private context: vscode.ExtensionContext,
    private messageRouter: MessageRouter
  ) {}

  static initialize(
    context: vscode.ExtensionContext,
    messageRouter: MessageRouter
  ): void {
    if (!WebViewPanelManager.instance) {
      WebViewPanelManager.instance = new WebViewPanelManager(context, messageRouter);
    }
  }

  static getInstance(): WebViewPanelManager {
    if (!WebViewPanelManager.instance) {
      throw new Error('WebViewPanelManager not initialized. Call initialize() first.');
    }
    return WebViewPanelManager.instance;
  }

  /**
   * Show the Nexus panel, creating it if it doesn't exist
   */
  show(options?: { tab?: string; visualizationType?: string }): void {
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (this.panel) {
      // Panel exists, reveal it
      this.panel.reveal(columnToShowIn);

      // If options provided, send message to switch tab/viz
      if (options) {
        this.panel.webview.postMessage({
          type: 'showTab',
          tab: options.tab,
          visualizationType: options.visualizationType,
        });
      }
    } else {
      // Create new panel
      this.panel = vscode.window.createWebviewPanel(
        'nexusPanel',
        'Nexus',
        columnToShowIn || vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true, // Persist state when hidden
          localResourceRoots: [
            vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
          ],
        }
      );

      // Set HTML content
      this.panel.webview.html = this.getWebviewContent(this.panel.webview);

      // Set icon
      this.panel.iconPath = vscode.Uri.file(
        path.join(this.context.extensionPath, 'resources', 'adverant-icon.svg')
      );

      // Handle messages from webview
      this.panel.webview.onDidReceiveMessage(
        async (message) => {
          await this.handleMessage(message);
        },
        null,
        this.disposables
      );

      // Handle panel disposal
      this.panel.onDidDispose(
        () => {
          this.panel = undefined;
          this.disposables.forEach((d) => d.dispose());
          this.disposables = [];
        },
        null,
        this.disposables
      );

      // If options provided, send message after a short delay
      if (options) {
        setTimeout(() => {
          this.panel?.webview.postMessage({
            type: 'showTab',
            tab: options.tab,
            visualizationType: options.visualizationType,
          });
        }, 100);
      }
    }
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: any): Promise<void> {
    if (message.type === 'request') {
      // Route through MessageRouter
      const response = await this.messageRouter.route(message.data);

      // Send response back to webview
      this.panel?.webview.postMessage({
        type: 'response',
        data: response,
      });
    } else if (message.type === 'openFile') {
      // Handle file open requests from visualizations
      const uri = vscode.Uri.file(message.filePath);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.One,
      });
    } else if (message.type === 'executeCommand') {
      // Handle VSCode command execution
      await vscode.commands.executeCommand(message.command, ...message.args);
    }
  }

  /**
   * Get the HTML content for the webview
   */
  private getWebviewContent(webview: vscode.Webview): string {
    const mediaPath = vscode.Uri.file(path.join(this.context.extensionPath, 'media'));
    const mediaUri = webview.asWebviewUri(mediaPath);

    const htmlPath = path.join(this.context.extensionPath, 'media', 'index.html');
    const fs = require('fs');
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Replace placeholders with actual URIs
    html = html.replace(/{{mediaUri}}/g, mediaUri.toString());

    // Add CSP nonce for inline scripts
    const nonce = this.getNonce();
    html = html.replace(/{{nonce}}/g, nonce);

    // Add Content Security Policy
    html = html.replace(
      '<head>',
      `<head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:; font-src ${webview.cspSource};">`
    );

    return html;
  }

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Dispose of the panel manager
   */
  dispose(): void {
    this.panel?.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
