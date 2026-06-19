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
exports.DashboardService = void 0;
const vscode = __importStar(require("vscode"));
class DashboardService {
    constructor(storageService, statisticsService) {
        this.storageService = storageService;
        this.statisticsService = statisticsService;
    }
    async exportJson() {
        try {
            const usageRecords = await this.storageService.getUsageRecords();
            const modelProfiles = await this.storageService.getModelProfiles();
            const sessionStats = await this.statisticsService.getSessionStats();
            const lifetimeStats = await this.statisticsService.getLifetimeStats();
            const data = {
                usageRecords,
                modelProfiles,
                sessionStats,
                lifetimeStats
            };
            const uri = await vscode.window.showSaveDialog({
                filters: {
                    'JSON Files': ['json']
                }
            });
            if (uri) {
                const content = JSON.stringify(data, null, 2);
                await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
                vscode.window.showInformationMessage('Token Tracker data exported successfully.');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to export data: ' + error);
        }
    }
    async importJson() {
        try {
            const uri = await vscode.window.showOpenDialog({
                filters: {
                    'JSON Files': ['json']
                }
            });
            if (uri && uri[0]) {
                const content = await vscode.workspace.fs.readFile(uri[0]);
                const data = JSON.parse(content.toString());
                // Restore data
                await this.storageService.updateGlobalState('usageRecords', data.usageRecords);
                await this.storageService.updateGlobalState('modelProfiles', data.modelProfiles);
                await this.storageService.updateGlobalState('sessionStats', data.sessionStats);
                await this.storageService.updateGlobalState('lifetimeStats', data.lifetimeStats);
                vscode.window.showInformationMessage('Token Tracker data imported successfully.');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to import data: ' + error);
        }
    }
    async exportCsv() {
        try {
            const usageRecords = await this.storageService.getUsageRecords();
            let csvContent = 'Timestamp,Model,Prompt Tokens,Completion Tokens,Total Tokens,Cost\n';
            for (const record of usageRecords) {
                csvContent += `${record.timestamp},${record.model},${record.promptTokens},${record.completionTokens},${record.totalTokens},${record.cost}\n`;
            }
            const uri = await vscode.window.showSaveDialog({
                filters: {
                    'CSV Files': ['csv']
                }
            });
            if (uri) {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(csvContent));
                vscode.window.showInformationMessage('Token Tracker data exported to CSV successfully.');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to export CSV: ' + error);
        }
    }
    async importCsv() {
        try {
            const uri = await vscode.window.showOpenDialog({
                filters: {
                    'CSV Files': ['csv']
                }
            });
            if (uri && uri[0]) {
                const content = await vscode.workspace.fs.readFile(uri[0]);
                const lines = content.toString().split('\n');
                // Skip header
                const records = [];
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line) {
                        const parts = line.split(',');
                        if (parts.length >= 6) {
                            records.push({
                                id: Date.now().toString() + i.toString(),
                                timestamp: parseInt(parts[0]),
                                model: parts[1],
                                promptTokens: parseInt(parts[2]),
                                completionTokens: parseInt(parts[3]),
                                totalTokens: parseInt(parts[4]),
                                cost: parseFloat(parts[5])
                            });
                        }
                    }
                }
                // Restore records
                await this.storageService.updateGlobalState('usageRecords', records);
                vscode.window.showInformationMessage('Token Tracker data imported from CSV successfully.');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to import CSV: ' + error);
        }
    }
    async clearHistory() {
        const confirm = vscode.workspace.getConfiguration('tokenTracker').get('confirmBeforeDelete', true);
        if (confirm) {
            const result = await vscode.window.showWarningMessage('Are you sure you want to clear all usage history?', 'Yes', 'No');
            if (result !== 'Yes') {
                return;
            }
        }
        await this.storageService.clearUsageRecords();
        await this.statisticsService.resetSession();
        vscode.window.showInformationMessage('Token Tracker history cleared successfully.');
    }
    async getSessionStats() {
        return this.statisticsService.getSessionStats();
    }
    async getLifetimeStats() {
        return this.statisticsService.getLifetimeStats();
    }
    async resetSession() {
        return this.statisticsService.resetSession();
    }
    async getCurrentCostSettings() {
        const profile = this.storageService.getCurrentModelProfile();
        return {
            inputCostPerMillion: profile?.inputCostPerMillion ?? 0,
            outputCostPerMillion: profile?.outputCostPerMillion ?? 0
        };
    }
    async updateCost(inputCostPerMillion, outputCostPerMillion) {
        const profiles = await this.storageService.getModelProfiles();
        const updatedProfiles = profiles.map(p => ({
            ...p,
            inputCostPerMillion: inputCostPerMillion,
            outputCostPerMillion: outputCostPerMillion
        }));
        await this.storageService.updateGlobalState('modelProfiles', updatedProfiles);
        vscode.window.showInformationMessage('Cost settings updated successfully.');
    }
}
exports.DashboardService = DashboardService;
//# sourceMappingURL=dashboardService.js.map