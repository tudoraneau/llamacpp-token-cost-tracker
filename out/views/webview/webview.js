"use strict";
/// <reference lib="dom" />
const vscode = acquireVsCodeApi();
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = document.getElementById('dashboard');
    if (dashboard) {
        dashboard.innerHTML = `
            <div class="card">
                <div class="card-title">Session Statistics</div>
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
            
            <div class="card">
                <div class="card-title">Lifetime Statistics</div>
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
            
            <div class="card">
                <div class="card-title">Cost Settings</div>
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
            
            <div class="card">
                <div class="card-title">Actions</div>
                <button onclick="handleCommand('exportJson')">Export JSON</button>
                <button onclick="handleCommand('exportCsv')">Export CSV</button>
                <button onclick="handleCommand('importJson')">Import JSON</button>
                <button onclick="handleCommand('importCsv')">Import CSV</button>
                <button onclick="handleCommand('manageModels')">Manage Models</button>
                <button class="secondary" onclick="handleCommand('resetSession')">Reset Session</button>
                <button class="danger" onclick="handleCommand('clearHistory')">Clear History</button>
            </div>
        `;
        // Add event listener for Enter key in cost input fields
        const inputCost = document.getElementById('input-cost');
        const outputCost = document.getElementById('output-cost');
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
    }
    // Request initial data
    vscode.postMessage({ command: 'refresh' });
});
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
window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
        case 'updateStats':
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