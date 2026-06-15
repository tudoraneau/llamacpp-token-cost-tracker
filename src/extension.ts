import * as vscode from 'vscode';
import { StorageService } from './services/storageService';
import { DashboardService } from './services/dashboardService';
import { PricingService } from './services/pricingService';
import { StatisticsService } from './services/statisticsService';
import { LlamaCppClient } from './services/llamaCppClient';
import { TokenTrackerView } from './views/tokenTrackerView';

export async function activate(context: vscode.ExtensionContext) {
    // Initialize services
    const storageService = new StorageService(context);
    const pricingService = new PricingService(storageService);
    const statisticsService = new StatisticsService(storageService);
    const dashboardService = new DashboardService(storageService, statisticsService);
    
    // Initialize client
    const client = new LlamaCppClient(
        vscode.workspace.getConfiguration('tokenTracker.llamaCpp').get<string>('serverUrl', 'http://localhost:8080'),
        vscode.workspace.getConfiguration('tokenTracker.llamaCpp').get<number>('requestTimeoutMs', 5000)
    );
    
    // Create views
    const tokenTrackerView = new TokenTrackerView(context, dashboardService);
    
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
        vscode.commands.registerCommand('token-tracker.manageModels', () => dashboardService.manageModels()),
        vscode.commands.registerCommand('token-tracker.backupDatabase', () => storageService.backup()),
        vscode.commands.registerCommand('token-tracker.restoreDatabase', () => storageService.restore()),
        vscode.commands.registerCommand('token-tracker.selectLogFile', () => {
            vscode.window.showOpenDialog({
                filters: {
                    'Log Files': ['log', 'txt']
                }
            }).then((fileUri) => {
                if (fileUri && fileUri[0]) {
                    vscode.workspace.getConfiguration('tokenTracker.llamaCpp').update('logPath', fileUri[0].fsPath, true);
                }
            });
        }),
        vscode.commands.registerCommand('token-tracker.stopLogMonitoring', () => {
            // Log monitoring will be handled differently
        })
    ];
    
    // Add to extension context
    context.subscriptions.push(...commands, tokenTrackerView);
    
    // Initialize status bar
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'token-tracker.openDashboard';
    statusBar.text = 'Token Tracker';
    statusBar.show();
    
    // Update status bar with current stats
    const updateStatusBar = async () => {
        // Get current model and stats
        const currentModel = storageService.getCurrentModelName();
        const sessionStats = await statisticsService.getSessionStats();
        const lifetimeStats = await statisticsService.getLifetimeStats();
        
        let statusText = currentModel ? currentModel : 'No model';
        
        if (sessionStats.totalTokens > 0) {
            const totalTokensFormatted = sessionStats.totalTokens >= 1000000 
                ? `${(sessionStats.totalTokens / 1000000).toFixed(1)}M` 
                : sessionStats.totalTokens;
            statusText += ` | ${totalTokensFormatted} Tokens`;
            
            // Calculate cost if enabled
            const cost = pricingService.calculateCost(
                sessionStats.promptTokens,
                sessionStats.completionTokens
            );
            if (cost > 0) {
                statusText += ` | $${cost.toFixed(2)}`;
            }
        }
        
        statusBar.text = statusText;
    };
    
    // Update status bar when stats change
    statisticsService.onStatsChanged(updateStatusBar);
    updateStatusBar();
    
    // Handle configuration changes
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('tokenTracker.llamaCpp')) {
            const config = vscode.workspace.getConfiguration('tokenTracker.llamaCpp');
            client.updateConfig(
                config.get<string>('serverUrl', 'http://localhost:8080'),
                config.get<number>('requestTimeoutMs', 5000)
            );
            // Refresh status bar to reflect new connection state
            await updateStatusBar();
        }
    });

    context.subscriptions.push(configChangeListener);
}

export function deactivate() {}

