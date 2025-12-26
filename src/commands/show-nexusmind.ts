import * as vscode from 'vscode';
import { GraphRAGClient } from '../clients/graphrag-client';

export async function showNexusMindCommand(client: GraphRAGClient, nexusMindProvider: any) {
  vscode.window.showInformationMessage('NexusMind visualization coming soon!');
  // TODO: Implement NexusMind webview visualization
}
