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
    }
    // Request initial data
    vscode.postMessage({ command: 'refresh' });
});
function handleCommand(command) {
    vscode.postMessage({ command });
}
window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.command) {
        case 'updateStats':
            if (message.sessionStats) {
                const promptEl = document.getElementById('prompt-tokens');
                const completionEl = document.getElementById('completion-tokens');
                const totalEl = document.getElementById('total-tokens');
                if (promptEl)
                    promptEl.textContent = String(message.sessionStats.promptTokens || '0');
                if (completionEl)
                    completionEl.textContent = String(message.sessionStats.completionTokens || '0');
                if (totalEl)
                    totalEl.textContent = String(message.sessionStats.totalTokens || '0');
            }
            break;
    }
});
console.log('Token Tracker Webview loaded');
//# sourceMappingURL=webview.js.map