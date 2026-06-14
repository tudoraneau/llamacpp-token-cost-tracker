import * as vscode from 'vscode';
import { DashboardService } from '../services/dashboardService';

export class TokenTrackerView implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private dashboardService: DashboardService;
    
    constructor(private context: vscode.ExtensionContext, dashboardService: DashboardService) {
        this.dashboardService = dashboardService;
    }
    
    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'out')
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
                    await this.dashboardService.clearHistory();
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
            }
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
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview.js'));
        
        // Get the URI for the webview CSS
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview.css'));
        
        // Get the URI for Chart.js
        const chartUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'out', 'chart.min.js'));
        
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
    <script src="${chartUri}"></script>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}