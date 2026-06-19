"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const storageService_1 = require("./services/storageService");
const dashboardService_1 = require("./services/dashboardService");
const pricingService_1 = require("./services/pricingService");
const statisticsService_1 = require("./services/statisticsService");
const llamaCppClient_1 = require("./services/llamaCppClient");
const llamaCppProxy_1 = require("./services/llamaCppProxy");
const llamaCppUsageMonitor_1 = require("./services/llamaCppUsageMonitor");
const tokenTrackerView_1 = require("./views/tokenTrackerView");
let usageMonitor = null;
let proxy = null;
const PROXY_PORT = 8081;
const LLAMA_CPP_DEFAULT_PORT = 8080;
async function activate(context) {
    // Initialize services
    const storageService = new storageService_1.StorageService(context);
    const pricingService = new pricingService_1.PricingService(storageService);
    const statisticsService = new statisticsService_1.StatisticsService(storageService);
    const dashboardService = new dashboardService_1.DashboardService(storageService, statisticsService);
    // Get configuration
    const llamaCppConfig = vscode.workspace.getConfiguration('tokenTracker.llamaCpp');
    const serverUrl = llamaCppConfig.get('serverUrl', 'http://localhost:8080');
    const requestTimeoutMs = llamaCppConfig.get('requestTimeoutMs', 5000);
    const logPath = llamaCppConfig.get('logPath', '');
    const proxyConfig = vscode.workspace.getConfiguration('tokenTracker.proxy');
    const proxyTargetUrl = proxyConfig.get('targetUrl', 'http://localhost:8080');
    // Start proxy to intercept and track requests
    proxy = new llamaCppProxy_1.LlamaCppProxy(PROXY_PORT, proxyTargetUrl);
    proxy.setServices(storageService, statisticsService, pricingService);
    try {
        await proxy.start();
    }
    catch (error) {
        console.error('[TokenTracker] Failed to start proxy:', error);
        vscode.window.showErrorMessage('Token Tracker: Failed to start proxy. Please check if port ' + PROXY_PORT + ' is available.');
        return;
    }
    // Initialize client with services for token tracking - route through proxy
    const client = new llamaCppClient_1.LlamaCppClient(proxy.getProxyUrl(), requestTimeoutMs);
    client.setServices(storageService, statisticsService, pricingService);
    // Initialize log file monitoring if configured
    if (logPath) {
        usageMonitor = new llamaCppUsageMonitor_1.LlamaCppUsageMonitor(logPath);
        usageMonitor.setServices(storageService, statisticsService);
        await usageMonitor.start();
    }
    // Create views
    const tokenTrackerView = new tokenTrackerView_1.TokenTrackerView(context, dashboardService, client, proxy);
    // Register webview view provider
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('token-tracker-view', tokenTrackerView));
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
                const cost = pricingService.calculateCost(sessionStats.promptTokens, sessionStats.completionTokens);
                if (cost > 0) {
                    statusText += ` | $${cost.toFixed(4)}`;
                }
            }
            statusBar.text = statusText;
        }
        catch (error) {
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
            const newServerUrl = config.get('serverUrl', 'http://localhost:8080');
            const newTimeout = config.get('requestTimeoutMs', 5000);
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
async function deactivate() {
    if (usageMonitor) {
        usageMonitor.stop();
    }
    if (proxy) {
        await proxy.stop();
    }
}
//# sourceMappingURL=extension.js.map