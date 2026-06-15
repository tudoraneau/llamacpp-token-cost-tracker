import * as vscode from 'vscode';
import { DashboardService } from '../services/dashboardService';
import { LlamaCppClient } from '../services/llamaCppClient';

export class TokenTrackerView implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private dashboardService: DashboardService;
    private llamaCppClient: LlamaCppClient;
    
    constructor(private context: vscode.ExtensionContext, dashboardService: DashboardService, llamaCppClient: LlamaCppClient) {
        this.dashboardService = dashboardService;
        this.llamaCppClient = llamaCppClient;
    }
    
    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'out'),
                vscode.Uri.joinPath(this.context.extensionUri, 'src')
            ]
        };
        
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'openDashboard':
                    // This command is handled by the extension activation
                    break;
                case 'exportJson':
                    await this.dashboardService.exportJson();
                    break;
                case 'exportCsv':
                    await this.dashboardService.exportCsv();
                    break;
                case 'importJson':
                    await this.dashboardService.importJson();
                    break;
                case 'importCsv':
                    await this.dashboardService.importCsv();
                    break;
                case 'resetSession':
                    await this.dashboardService.resetSession();
                    break;
                case 'clearHistory':
                    await this.dashboardService.clearHistory();
                    break;
                case 'manageModels':
                    await this.dashboardService.manageModels();
                    break;
                case 'backupDatabase':
                    await vscode.commands.executeCommand('token-tracker.backupDatabase');
                    break;
                case 'restoreDatabase':
                    await vscode.commands.executeCommand('token-tracker.restoreDatabase');
                    break;
                case 'selectLogFile':
                    await vscode.commands.executeCommand('token-tracker.selectLogFile');
                    break;
                case 'stopLogMonitoring':
                    await vscode.commands.executeCommand('token-tracker.stopLogMonitoring');
                    break;
                case 'updateCost':
                    await this.dashboardService.updateCost(
                        message.inputCostPerMillion,
                        message.outputCostPerMillion
                    );
                    // After updating cost settings, inform the webview to refresh the displayed values
                    const updatedCostSettings = await this.dashboardService.getCurrentCostSettings();
                    if (this._view) {
        this._view.webview.postMessage({
                            command: 'updateCostSettings',
                            costSettings: updatedCostSettings
        });
    }
                    break;
                case 'updateServerUrl':
                    await vscode.workspace.getConfiguration('tokenTracker.llamaCpp').update('serverUrl', message.serverUrl, true);
                    if (this._view) {
        this._view.webview.postMessage({
                            command: 'serverUrlUpdated',
                            serverUrl: message.serverUrl
        });
    }
                    break;
                case 'refresh':
                    await this.refreshDashboard();
                    break;
            }
        });
    }
    
    public async refreshDashboard() {
        if (!this._view) {
            return;
        }
        
        // Get current stats and cost settings
        const sessionStats = await this.dashboardService.getSessionStats();
        const lifetimeStats = await this.dashboardService.getLifetimeStats();
        const costSettings = await this.dashboardService.getCurrentCostSettings();
        const serverUrl = vscode.workspace.getConfiguration('tokenTracker.llamaCpp').get<string>('serverUrl', 'http://localhost:8080');

        // Check connection status
        const connected = await this.llamaCppClient.isConnected();

        // Send updated stats to webview
        this._view.webview.postMessage({
            command: 'updateStats',
            sessionStats,
            lifetimeStats,
            costSettings,
            serverUrl,
            connected
        });
    }
    
    public open() {
        if (!this._view) {
            vscode.window.showErrorMessage('Dashboard not initialized');
            return;
        }
        
        this._view.show(true);
    }

    public dispose() {
        if (this._view) {
            this._view = undefined;
        }
    }
    
    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the URI for the webview script
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'views', 'webview', 'webview.js'));
        
        // Get the URI for the webview CSS
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'src', 'views', 'webview', 'webview.css'));
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Token Tracker</title>
    <link href="${styleUri}" rel="stylesheet">
</head>
<body>
    <div class="container">
        <h1>Token Cost Tracker</h1>
        <div id="dashboard"></div>
    </div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}