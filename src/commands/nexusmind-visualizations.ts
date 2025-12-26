import * as vscode from 'vscode';
import { VisualizationHandler } from '../handlers/visualization-handler';
import { WebViewPanelManager } from '../webview/WebViewPanelManager';

export async function dependencyGraphCommand(visualizationHandler: VisualizationHandler) {
  WebViewPanelManager.getInstance().show({
    tab: 'visualizations',
    visualizationType: 'dependencyGraph'
  });
}

export async function evolutionTimelineCommand(visualizationHandler: VisualizationHandler) {
  WebViewPanelManager.getInstance().show({
    tab: 'visualizations',
    visualizationType: 'evolutionTimeline'
  });
}

export async function impactRippleCommand(visualizationHandler: VisualizationHandler) {
  WebViewPanelManager.getInstance().show({
    tab: 'visualizations',
    visualizationType: 'impactRipple'
  });
}

export async function semanticClustersCommand(visualizationHandler: VisualizationHandler) {
  WebViewPanelManager.getInstance().show({
    tab: 'visualizations',
    visualizationType: 'semanticClusters'
  });
}

export async function architectureAnalyzeCommand(visualizationHandler: VisualizationHandler) {
  WebViewPanelManager.getInstance().show({
    tab: 'visualizations',
    visualizationType: 'architecture'
  });
}

export async function nlQueryCommand(visualizationHandler: VisualizationHandler) {
  WebViewPanelManager.getInstance().show({
    tab: 'visualizations',
    visualizationType: 'nlQuery'
  });
}
