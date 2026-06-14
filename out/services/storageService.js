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
exports.StorageService = void 0;
const vscode = __importStar(require("vscode"));
class StorageService {
    constructor(context) {
        this.storageKey = 'tokenTrackerData';
        this.context = context;
    }
    // Save data to extension context
    async saveData(data) {
        await this.context.globalState.update(this.storageKey, data);
    }
    // Load data from extension context
    async loadData() {
        return this.context.globalState.get(this.storageKey, {});
    }
    // Backup database
    async backup() {
        const data = await this.loadData();
        const backupData = {
            ...data,
            backupTimestamp: new Date().toISOString()
        };
        const uri = await vscode.window.showSaveDialog({
            filters: {
                'JSON files': ['json']
            }
        });
        if (uri) {
            const fs = require('fs');
            fs.writeFileSync(uri.fsPath, JSON.stringify(backupData, null, 2));
        }
    }
    // Restore database
    async restore() {
        const uri = await vscode.window.showOpenDialog({
            filters: {
                'JSON files': ['json']
            }
        });
        if (uri && uri[0]) {
            const fs = require('fs');
            const data = fs.readFileSync(uri[0].fsPath, 'utf8');
            const restoreData = JSON.parse(data);
            await this.saveData(restoreData);
        }
    }
    // Get current model name
    getCurrentModelName() {
        const config = vscode.workspace.getConfiguration('tokenTracker');
        return config.get('currentModel', 'Unknown');
    }
    // Usage Records methods
    async getUsageRecords() {
        return this.context.globalState.get('usageRecords', []);
    }
    async addUsageRecord(record) {
        const records = await this.getUsageRecords();
        records.push(record);
        await this.context.globalState.update('usageRecords', records);
    }
    async clearUsageRecords() {
        await this.context.globalState.update('usageRecords', []);
    }
    // Model Profile methods
    async getModelProfiles() {
        const defaultProfiles = [
            {
                id: 'default',
                name: 'Default Model',
                contextLength: 4096,
                inputCostPerMillion: 0,
                outputCostPerMillion: 0,
                notes: '',
                isActive: true
            }
        ];
        return this.context.globalState.get('modelProfiles', defaultProfiles);
    }
    getCurrentModelProfile() {
        const profiles = this.context.globalState.get('modelProfiles', []);
        return profiles.find(p => p.isActive) || profiles[0];
    }
    async setActiveModelProfile(profileId) {
        const profiles = await this.getModelProfiles();
        const updatedProfiles = profiles.map(p => ({
            ...p,
            isActive: p.id === profileId
        }));
        await this.context.globalState.update('modelProfiles', updatedProfiles);
    }
    async deleteModelProfile(profileId) {
        const profiles = await this.getModelProfiles();
        const updatedProfiles = profiles.filter(p => p.id !== profileId);
        await this.context.globalState.update('modelProfiles', updatedProfiles);
    }
    // Statistics methods
    async getSessionStats() {
        return this.context.globalState.get('sessionStats', {
            requests: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            cost: 0
        });
    }
    async getLifetimeStats() {
        return this.context.globalState.get('lifetimeStats', {
            requests: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            cost: 0
        });
    }
    async updateSessionStats(delta) {
        const current = await this.getSessionStats();
        const updated = {
            requests: current.requests + (delta.requests ?? 0),
            promptTokens: current.promptTokens + (delta.promptTokens ?? 0),
            completionTokens: current.completionTokens + (delta.completionTokens ?? 0),
            totalTokens: current.totalTokens + (delta.totalTokens ?? 0),
            cost: current.cost + (delta.cost ?? 0)
        };
        await this.context.globalState.update('sessionStats', updated);
    }
    async updateLifetimeStats(delta) {
        const current = await this.getLifetimeStats();
        const updated = {
            requests: current.requests + (delta.requests ?? 0),
            promptTokens: current.promptTokens + (delta.promptTokens ?? 0),
            completionTokens: current.completionTokens + (delta.completionTokens ?? 0),
            totalTokens: current.totalTokens + (delta.totalTokens ?? 0),
            cost: current.cost + (delta.cost ?? 0)
        };
        await this.context.globalState.update('lifetimeStats', updated);
    }
    // Public method to update global state (for import/export)
    async updateGlobalState(key, value) {
        await this.context.globalState.update(key, value);
    }
}
exports.StorageService = StorageService;
//# sourceMappingURL=storageService.js.map