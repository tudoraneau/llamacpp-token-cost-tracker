import * as vscode from 'vscode';
import { StorageService } from './services/storageService';
import { DashboardService } from './services/dashboardService';
import { PricingService } from './services/pricingService';
import { StatisticsService } from './services/statisticsService';
import { LlamaCppClient } from './services/llamaCppClient';
import { LlamaCppProxy } from './services/llamaCppProxy';
import { LlamaCppUsageMonitor } from './services/llamaCppUsageMonitor';
import { TokenTrackerView } from './views/tokenTrackerView';

let usageMonitor: LlamaCppUsageMonitor | null = null;
let proxy: LlamaCppProxy | null = null;

const PROXY_PORT = 8081;
const LLAMA_CPP_DEFAULT_PORT = 8080;
export async function activate(context: vscode.ExtensionContext) {
    // Initialize services
    const storageService = new StorageService(context);
    const pricingService = new PricingService(storageService);
    const statisticsService = new StatisticsService(storageService);
    const dashboardService = new DashboardService(storageService, statisticsService);
    
    // Get configuration
        const llamaCppConfig = vscode.workspace.getConfiguration('tokenTracker.llamaCpp');
        const serverUrl = llamaCppConfig.get<string>('serverUrl', 'http://localhost:8080');
        const requestTimeoutMs = llamaCppConfig.get<number>('requestTimeoutMs', 5000);
        const logPath = llamaCppConfig.get<string>('logPath', '');
        
        const proxyConfig = vscode.workspace.getConfiguration('tokenTracker.proxy');
        const proxyTargetUrl = proxyConfig.get<string>('targetUrl', 'http://localhost:8080');
    
        // Start proxy to intercept and track requests
        proxy = new LlamaCppProxy(PROXY_PORT, proxyTargetUrl);
        proxy.setServices(storageService, statisticsService, pricingService);
    
        try {
            await proxy.start();
        } catch (error) {
            console.error('[TokenTracker] Failed to start proxy:', error);
            vscode.window.showErrorMessage('Token Tracker: Failed to start proxy. Please check if port ' + PROXY_PORT + ' is available.');
            return;
        }
    
        // Initialize client with services for token tracking - route through proxy
        const client = new LlamaCppClient(proxy.getProxyUrl(), requestTimeoutMs);
        client.setServices(storageService, statisticsService, pricingService);
    
        // Initialize log file monitoring if configured
    if (logPath) {
        usageMonitor = new LlamaCppUsageMonitor(logPath);
        usageMonitor.setServices(storageService, statisticsService);
        await usageMonitor.start();
    }
    
    // Create views
    const tokenTrackerView = new TokenTrackerView(context, dashboardService, client, proxy);
    
    // Register webview view provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('token-tracker-view', tokenTrackerView)
    );
    
    // Register commands
    const commands = [
        vscode.commands.registerCommand('token-tracker.openDashboard', () => tokenTrackerView.open()),
        vscode.commands.registerCommand('token-tracker.exportJson', () => dashboardService.exportJson()),
        vscode.commands.registerCommand('token-tracker.exportCsv', () => dashboardService.exportCsv()),
        vscode.commands.registerCommand('token-tracker.importJson', () => dashboardService.importJson()),
        vscode.commands.registerCommand('token-tracker.importCsv', () => dashboardService.importCsv()),
        vscode.commands.registerCommand('token-tracker.resetSession', () => statisticsService.resetSession()),
        vscode.commands.registerCommand('token-tracker.clearHistory', () => dashboardService.clearHistory()),
        vscode.commands.registerCommand('token-tracker.backupDatabase', () => storageService.backup()),
        vscode.commands.registerCommand('token-tracker.restoreDatabase', () => storageService.restore()),
        vscode.commands.registerCommand('token-tracker.selectLogFile', async () => {
            const fileUri = await vscode.window.showOpenDialog({
                filters: { 'Log Files': ['log', 'txt'] }
            });
                if (fileUri && fileUri[0]) {
                await vscode.workspace.getConfiguration('tokenTracker.llamaCpp').update('logPath', fileUri[0].fsPath, true);
                vscode.window.showInformationMessage(`Log monitoring started for: ${fileUri[0].fsPath}`);
                }
        }),
                vscode.commands.registerCommand('token-tracker.stopLogMonitoring', () => {
            if (usageMonitor) {
                usageMonitor.stop();
                usageMonitor = null;
                vscode.window.showInformationMessage('Log monitoring stopped.');
            }
        }),
    ];
    
    // Add to extension context
    context.subscriptions.push(...commands, tokenTrackerView);
    
    // Initialize status bar
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'token-tracker.openDashboard';
    statusBar.text = '$(pulse) Token Tracker';
    statusBar.show();
    context.subscriptions.push(statusBar);
    
    // Update status bar with current stats
    const updateStatusBar = async () => {
        try {
        const currentModel = storageService.getCurrentModelName();
        const sessionStats = await statisticsService.getSessionStats();
            let statusText = currentModel ? `$(check) ${currentModel}` : '$(question) No model';
        
        if (sessionStats.totalTokens > 0) {
                const formatted = sessionStats.totalTokens >= 1000000
                ? `${(sessionStats.totalTokens / 1000000).toFixed(1)}M` 
                    : sessionStats.totalTokens.toLocaleString();
                statusText += ` | ${formatted} tokens`;
            
            const cost = pricingService.calculateCost(
                sessionStats.promptTokens,
                sessionStats.completionTokens
            );
            if (cost > 0) {
                    statusText += ` | $${cost.toFixed(4)}`;
            }
        }
        
        statusBar.text = statusText;
        } catch (error) {
            console.error('[TokenTracker] Error updating status bar:', error);
        }
    };
    
    // Update status bar when stats change
    statisticsService.onStatsChanged(updateStatusBar);
    await updateStatusBar();
    
    // Handle configuration changes
        const configChangeListener = vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('tokenTracker.llamaCpp')) {
                const config = vscode.workspace.getConfiguration('tokenTracker.llamaCpp');
                const newServerUrl = config.get<string>('serverUrl', 'http://localhost:8080');
                const newTimeout = config.get<number>('requestTimeoutMs', 5000);
            
                // Update proxy target if server URL changed
                if (proxy) {
                    proxy.updateTarget(newServerUrl);
                }
            
                if (proxy) {
                    client.updateConfig(proxy?.getProxyUrl() ?? 'http://localhost:8081', newTimeout);
                }
                await updateStatusBar();
            }
        });

    context.subscriptions.push(configChangeListener);
}

export async function deactivate() {
    if (usageMonitor) {
        usageMonitor.stop();
    }
    if (proxy) {
        await proxy.stop();
    }
}

