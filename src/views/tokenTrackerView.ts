import * as vscode from 'vscode';
import { DashboardService } from '../services/dashboardService';
import { LlamaCppClient } from '../services/llamaCppClient';
import { LlamaCppProxy } from '../services/llamaCppProxy';
import { StorageService } from '../services/storageService';
import { OneDriveSyncService } from '../services/onedriveSyncService';

export class TokenTrackerView implements vscode.WebviewViewProvider {
    private proxy: LlamaCppProxy | null = null;
    private _view?: vscode.WebviewView;
    private dashboardService: DashboardService;
    private llamaCppClient: LlamaCppClient;
    private storageService: StorageService;
    private onedriveSyncService: OneDriveSyncService | null = null;
    
    constructor(private context: vscode.ExtensionContext, dashboardService: DashboardService, llamaCppClient: LlamaCppClient, proxy: LlamaCppProxy, storageService: StorageService, onedriveSyncService: OneDriveSyncService | null = null) {
        this.dashboardService = dashboardService;
        this.llamaCppClient = llamaCppClient;
        this.proxy = proxy;
        this.storageService = storageService;
        this.onedriveSyncService = onedriveSyncService;
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
                case 'exportCsv':
                    await this.dashboardService.exportCsv();
                    break;
                case 'importCsv':
                    await this.dashboardService.importCsv();
                    await this.refreshDashboard();
                    break;
                case 'resetSession':
                    await this.dashboardService.resetSession();
                    await this.refreshDashboard();
                    break;
                case 'clearHistory':
                    await this.dashboardService.clearHistory();
                    await this.refreshDashboard();
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
                case 'syncToOneDrive':
                    await vscode.commands.executeCommand('token-tracker.syncToOneDrive');
                    break;
                case 'restoreFromOneDrive':
                    await vscode.commands.executeCommand('token-tracker.restoreFromOneDrive');
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
                case 'toggleProxy':
                    await this.toggleProxy();
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
                case 'updateProxySettings':
                    // Update proxy target URL when proxy settings are updated
                    if (message.serverUrl) {
                        await vscode.workspace.getConfiguration('tokenTracker.proxy').update('targetUrl', message.serverUrl, true);
                        if (this._view) {
                            this._view.webview.postMessage({
                                command: 'serverUrlUpdated',
                                serverUrl: message.serverUrl
                            });
                        }
                    }
                    break;
                case 'updateOneDrivePath':
                    // Escape backslashes for proper storage
                    const onedrivePath = message.onedrivePath.replace(/\\/g, '\\\\');
                    await vscode.workspace.getConfiguration('tokenTracker').update('onedrivePath', onedrivePath, true);
                    if (this._view) {
                        this._view.webview.postMessage({
                            command: 'onedrivePathUpdated',
                            onedrivePath: onedrivePath
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
        const proxyTargetUrl = vscode.workspace.getConfiguration('tokenTracker.proxy').get<string>('targetUrl', 'http://localhost:8080');
        const onedrivePath = vscode.workspace.getConfiguration('tokenTracker').get<string>('onedrivePath', '');
 
        // Check connection status
        const connected = await this.llamaCppClient.isConnected();
        
        // Check proxy status
        const proxyRunning = this.proxy ? this.proxy.isRunning() : false;
 
        // Get current model name
        const modelName = this.storageService.getCurrentModelName();
        
        // Get sync status
        const syncStatus = this.onedriveSyncService ? this.onedriveSyncService.getSyncStatus() : null;
        
        // Send updated stats to webview
        this._view.webview.postMessage({
            command: 'updateStats',
            sessionStats,
            lifetimeStats,
            costSettings,
            serverUrl,
            proxyTargetUrl,
            connected,
            proxyRunning,
            modelName,
            syncStatus,
            onedrivePath
        });
    }
    
    public async open() {
        if (!this._view) {
            vscode.window.showErrorMessage('Dashboard not initialized');
            return;
        }
        
        this._view.show(true);
        await this.refreshDashboard();
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
         <h1>llama.cpp Token Cost Tracker</h1>
         <div id="dashboard"></div>
     </div>
     <script src="${scriptUri}"></script>
 </body>
 </html>`;
     }
    
    private async toggleProxy() {
        if (!this.proxy) {
            return;
        }
        
        if (this.proxy.isRunning()) {
            await this.proxy.stop();
            this._view?.webview.postMessage({ command: 'proxyStatus', isRunning: false });
        } else {
            try {
                await this.proxy.start();
                this._view?.webview.postMessage({ command: 'proxyStatus', isRunning: true });
            } catch (error) {
                vscode.window.showErrorMessage('Failed to start proxy: ' + error);
            }
        }
    }
    
    private async updateProxySettings(proxyPort: number, serverUrl: string) {
        if (!this.proxy) {
            return;
        }
        
        try {
            await this.proxy.stop();
            this.proxy.updateTarget(serverUrl);
            
            // Update the proxy target URL configuration
            await vscode.workspace.getConfiguration('tokenTracker.proxy').update('targetUrl', serverUrl, true);
            
            await this.proxy.start();
            this._view?.webview.postMessage({ command: 'proxyStatus', isRunning: true });
            this._view?.webview.postMessage({ command: 'serverUrlUpdated', serverUrl: serverUrl });
        } catch (error) {
            vscode.window.showErrorMessage('Failed to update proxy settings: ' + error);
        }
    }
}