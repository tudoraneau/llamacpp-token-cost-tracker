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
exports.TokenTrackerView = void 0;
const vscode = __importStar(require("vscode"));
class TokenTrackerView {
    constructor(context, dashboardService, llamaCppClient, proxy, storageService) {
        this.context = context;
        this.proxy = null;
        this.dashboardService = dashboardService;
        this.llamaCppClient = llamaCppClient;
        this.proxy = proxy;
        this.storageService = storageService;
    }
    resolveWebviewView(webviewView) {
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
                    break;
                case 'resetSession':
                    await this.dashboardService.resetSession();
                    break;
                case 'clearHistory':
                    await this.dashboardService.clearHistory();
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
                    await this.dashboardService.updateCost(message.inputCostPerMillion, message.outputCostPerMillion);
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
                case 'refresh':
                    await this.refreshDashboard();
                    break;
            }
        });
    }
    async refreshDashboard() {
        if (!this._view) {
            return;
        }
        // Get current stats and cost settings
        const sessionStats = await this.dashboardService.getSessionStats();
        const lifetimeStats = await this.dashboardService.getLifetimeStats();
        const costSettings = await this.dashboardService.getCurrentCostSettings();
        const serverUrl = vscode.workspace.getConfiguration('tokenTracker.llamaCpp').get('serverUrl', 'http://localhost:8080');
        const proxyTargetUrl = vscode.workspace.getConfiguration('tokenTracker.proxy').get('targetUrl', 'http://localhost:8080');
        // Check connection status
        const connected = await this.llamaCppClient.isConnected();
        // Check proxy status
        const proxyRunning = this.proxy ? this.proxy.isRunning() : false;
        // Get current model name
        const modelName = this.storageService.getCurrentModelName();
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
            modelName
        });
    }
    async open() {
        if (!this._view) {
            vscode.window.showErrorMessage('Dashboard not initialized');
            return;
        }
        this._view.show(true);
        await this.refreshDashboard();
    }
    dispose() {
        if (this._view) {
            this._view = undefined;
        }
    }
    _getHtmlForWebview(webview) {
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
    async toggleProxy() {
        if (!this.proxy) {
            return;
        }
        if (this.proxy.isRunning()) {
            await this.proxy.stop();
            this._view?.webview.postMessage({ command: 'proxyStatus', isRunning: false });
        }
        else {
            try {
                await this.proxy.start();
                this._view?.webview.postMessage({ command: 'proxyStatus', isRunning: true });
            }
            catch (error) {
                vscode.window.showErrorMessage('Failed to start proxy: ' + error);
            }
        }
    }
    async updateProxySettings(proxyPort, serverUrl) {
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
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to update proxy settings: ' + error);
        }
    }
}
exports.TokenTrackerView = TokenTrackerView;
//# sourceMappingURL=tokenTrackerView.js.map