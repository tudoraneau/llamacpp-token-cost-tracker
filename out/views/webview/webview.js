"use strict";
/// <reference lib="dom" />
const vscode = acquireVsCodeApi();
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.innerHTML = `
            <div class="card">
                <div class="card-title">llama.cpp Status</div>
                <div class="connection-status" id="connection-status">
                    <div>
                        <span class="status-indicator" id="status-indicator"></span>
                        <span id="status-text">Checking connection...</span>
                    </div>
                    <div>
                        <span id="model-text" class="model-name"></span>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">Proxy Status</div>
                <div class="proxy-status">
                    <span class="proxy-led" id="proxy-led"></span>
                    <span id="proxy-status-text">Proxy: Stopped</span>
                    <button onclick="handleCommand('toggleProxy')" id="proxy-toggle-btn">Start Proxy</button>
                </div>
            </div>
            
            <div class="card collapsible">
                <div class="card-title">Proxy Settings</div>
                <div class="card-content">
                    <div class="server-settings">
                        <div class="input-group">
                            <label for="proxy-port">Proxy Port</label>
                            <input type="number" id="proxy-port" value="8081" min="1" max="65535">
                        </div>
                        <div class="input-group">
                            <label for="proxy-target-url">Proxy Target URL</label>
                            <input type="text" id="proxy-target-url" value="" placeholder="http://localhost:8080">
                        </div>
                        <button onclick="handleUpdateProxySettings()">Update Proxy Settings</button>
                    </div>
                </div>
            </div>
            
            <div class="card collapsible">
                <div class="card-title">Llama.cpp Configuration</div>
                <div class="card-content">
                    <div class="server-settings">
                        <div class="input-group">
                            <label for="server-url">llama.cpp Server URL</label>
                            <input type="text" id="server-url" value="" placeholder="http://localhost:8080">
                        </div>
                        <button onclick="handleUpdateServerUrl()">Update Server URL</button>
                    </div>
                </div>
            </div>
            
            <div class="card collapsible">
                <div class="card-title">Session Statistics</div>
                <div class="card-content">
                    <div class="stat-grid">
                        <div class="stat-item">
                            <div class="stat-value" id="prompt-tokens">0</div>
                            <div class="stat-label">Prompt Tokens</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value" id="completion-tokens">0</div>
                            <div class="stat-label">Completion Tokens</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value" id="total-tokens">0</div>
                            <div class="stat-label">Total Tokens</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value" id="cost">$0.00</div>
                            <div class="stat-label">Estimated Cost</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card collapsible">
                <div class="card-title">Lifetime Statistics</div>
                <div class="card-content">
                    <div class="stat-grid">
                        <div class="stat-item">
                            <div class="stat-value" id="lifetime-tokens">0</div>
                            <div class="stat-label">Total Tokens</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value" id="lifetime-cost">$0.00</div>
                            <div class="stat-label">Total Cost</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card collapsible">
                <div class="card-title">Cost Settings</div>
                <div class="card-content">
                    <div class="cost-settings">
                        <div class="input-group">
                            <label for="input-cost">Input Cost per 1M tokens ($)</label>
                            <input type="number" id="input-cost" step="0.01" min="0" value="0" placeholder="0.00">
                        </div>
                        <div class="input-group">
                            <label for="output-cost">Output Cost per 1M tokens ($)</label>
                            <input type="number" id="output-cost" step="0.01" min="0" value="0" placeholder="0.00">
                        </div>
                        <button onclick="handleUpdateCost()">Update Cost</button>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="card-title">Actions</div>
                <button onclick="handleCommand('exportCsv')">Export CSV</button>
                <button onclick="handleCommand('importCsv')">Import CSV</button>
                <button class="secondary" onclick="handleCommand('resetSession')">Reset Session</button>
                <button class="danger" onclick="handleCommand('clearHistory')">Clear History</button>
            </div>
        `;
        // Add event listener for Enter key in cost input fields
        const inputCost = document.getElementById('input-cost');
        const outputCost = document.getElementById('output-cost');
        const serverUrl = document.getElementById('server-url');
        if (inputCost) {
            inputCost.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleUpdateCost();
                }
            });
        }
        if (outputCost) {
            outputCost.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleUpdateCost();
                }
            });
        }
        if (serverUrl) {
            serverUrl.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleUpdateServerUrl();
                }
            });
        }
    }
    // Add toggle functionality for collapsible cards
    const collapsibleCards = document.querySelectorAll('.card.collapsible');
    collapsibleCards.forEach((card) => {
        const cardTitle = card.querySelector('.card-title');
        if (cardTitle) {
            cardTitle.addEventListener('click', () => {
                card.classList.toggle('collapsed');
            });
        }
    });
    // Request initial data
    vscode.postMessage({ command: 'refresh' });
});
function updateConnectionStatus(connected, modelName = '') {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const modelText = document.getElementById('model-text');
    if (statusIndicator && statusText) {
        if (connected) {
            statusIndicator.className = 'status-indicator connected';
            statusText.textContent = 'Connected to llama.cpp server';
        }
        else {
            statusIndicator.className = 'status-indicator disconnected';
            statusText.textContent = 'Disconnected from llama.cpp server';
        }
    }
    if (modelText) {
        if (modelName) {
            modelText.textContent = `Model: ${modelName}`;
            modelText.className = 'model-name';
        }
        else {
            modelText.textContent = '';
            modelText.className = 'model-name hidden';
        }
    }
}
function handleCommand(command) {
    vscode.postMessage({ command });
}
function handleUpdateCost() {
    const inputCostEl = document.getElementById('input-cost');
    const outputCostEl = document.getElementById('output-cost');
    if (inputCostEl && outputCostEl) {
        const inputCost = parseFloat(inputCostEl.value) || 0;
        const outputCost = parseFloat(outputCostEl.value) || 0;
        vscode.postMessage({
            command: 'updateCost',
            inputCostPerMillion: inputCost,
            outputCostPerMillion: outputCost
        });
    }
}
function handleUpdateServerUrl() {
    const serverUrlEl = document.getElementById('server-url');
    if (serverUrlEl) {
        const serverUrl = serverUrlEl.value.trim();
        vscode.postMessage({
            command: 'updateServerUrl',
            serverUrl: serverUrl
        });
    }
}
function handleUpdateProxySettings() {
    const proxyPortEl = document.getElementById('proxy-port');
    const proxyTargetUrlEl = document.getElementById('proxy-target-url');
    if (proxyPortEl && proxyTargetUrlEl) {
        const proxyPort = parseInt(proxyPortEl.value) || 8081;
        const proxyTargetUrl = proxyTargetUrlEl.value.trim();
        vscode.postMessage({
            command: 'updateProxySettings',
            proxyPort: proxyPort,
            serverUrl: proxyTargetUrl
        });
    }
}
function updateProxyStatus(isRunning) {
    const proxyLed = document.getElementById('proxy-led');
    const proxyStatusText = document.getElementById('proxy-status-text');
    const proxyToggleBtn = document.getElementById('proxy-toggle-btn');
    if (proxyLed) {
        proxyLed.className = 'proxy-led ' + (isRunning ? 'running' : 'stopped');
    }
    if (proxyStatusText) {
        proxyStatusText.textContent = 'Proxy: ' + (isRunning ? 'Running' : 'Stopped');
    }
    if (proxyToggleBtn) {
        proxyToggleBtn.textContent = isRunning ? 'Stop Proxy' : 'Start Proxy';
    }
}
window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
        case 'updateStats':
            // Update connection status
            if (typeof message.connected === 'boolean') {
                updateConnectionStatus(message.connected, message.modelName);
            }
            // Update proxy status
            if (typeof message.proxyRunning === 'boolean') {
                updateProxyStatus(message.proxyRunning);
            }
            if (message.sessionStats) {
                const promptEl = document.getElementById('prompt-tokens');
                const completionEl = document.getElementById('completion-tokens');
                const totalEl = document.getElementById('total-tokens');
                const costEl = document.getElementById('cost');
                if (promptEl)
                    promptEl.textContent = String(message.sessionStats.promptTokens || '0');
                if (completionEl)
                    completionEl.textContent = String(message.sessionStats.completionTokens || '0');
                if (totalEl)
                    totalEl.textContent = String(message.sessionStats.totalTokens || '0');
                if (costEl)
                    costEl.textContent = '$' + (message.sessionStats.cost || 0).toFixed(2);
            }
            if (message.lifetimeStats) {
                const lifetimeTokensEl = document.getElementById('lifetime-tokens');
                const lifetimeCostEl = document.getElementById('lifetime-cost');
                if (lifetimeTokensEl)
                    lifetimeTokensEl.textContent = String(message.lifetimeStats.totalTokens || '0');
                if (lifetimeCostEl)
                    lifetimeCostEl.textContent = '$' + (message.lifetimeStats.cost || 0).toFixed(2);
            }
            if (message.costSettings) {
                const inputCostEl = document.getElementById('input-cost');
                const outputCostEl = document.getElementById('output-cost');
                if (inputCostEl)
                    inputCostEl.value = String(message.costSettings.inputCostPerMillion || '0');
                if (outputCostEl)
                    outputCostEl.value = String(message.costSettings.outputCostPerMillion || '0');
            }
            if (message.serverUrl !== undefined) {
                const serverUrlEl = document.getElementById('server-url');
                if (serverUrlEl)
                    serverUrlEl.value = message.serverUrl || '';
            }
            if (message.proxyTargetUrl !== undefined) {
                const proxyTargetUrlEl = document.getElementById('proxy-target-url');
                if (proxyTargetUrlEl)
                    proxyTargetUrlEl.value = message.proxyTargetUrl || '';
            }
            break;
        case 'updateCostSettings':
            if (message.costSettings) {
                const inputCostEl = document.getElementById('input-cost');
                const outputCostEl = document.getElementById('output-cost');
                if (inputCostEl)
                    inputCostEl.value = String(message.costSettings.inputCostPerMillion || '0');
                if (outputCostEl)
                    outputCostEl.value = String(message.costSettings.outputCostPerMillion || '0');
            }
            break;
        case 'serverUrlUpdated':
            // Update the server URL field with the new value
            const serverUrlEl = document.getElementById('server-url');
            if (serverUrlEl) {
                serverUrlEl.value = message.serverUrl || '';
            }
            break;
        case 'proxyStatus':
            updateProxyStatus(message.isRunning);
            break;
        case 'costUpdated':
            // Show success message
            const card = document.querySelector('.card-title');
            if (card) {
                // Could add a toast notification here
                console.log('Cost updated successfully');
            }
            break;
    }
});
console.log('Token Tracker Webview loaded');
//# sourceMappingURL=webview.js.map