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
const tokenTrackerView_1 = require("./views/tokenTrackerView");
async function activate(context) {
    // Initialize services
    const storageService = new storageService_1.StorageService(context);
    const pricingService = new pricingService_1.PricingService(storageService);
    const statisticsService = new statisticsService_1.StatisticsService(storageService);
    const dashboardService = new dashboardService_1.DashboardService(storageService, statisticsService);
    // Initialize client
    const client = new llamaCppClient_1.LlamaCppClient(vscode.workspace.getConfiguration('tokenTracker.llamaCpp').get('serverUrl', 'http://localhost:8080'), vscode.workspace.getConfiguration('tokenTracker.llamaCpp').get('requestTimeoutMs', 5000));
    // Create views
    const tokenTrackerView = new tokenTrackerView_1.TokenTrackerView(context, dashboardService, client);
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
            const cost = pricingService.calculateCost(sessionStats.promptTokens, sessionStats.completionTokens);
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
            client.updateConfig(config.get('serverUrl', 'http://localhost:8080'), config.get('requestTimeoutMs', 5000));
            // Refresh status bar to reflect new connection state
            await updateStatusBar();
        }
    });
    context.subscriptions.push(configChangeListener);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map