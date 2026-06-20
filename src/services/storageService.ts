import * as vscode from 'vscode';
import { UsageRecord } from '../models/usageRecord';
import { ModelProfile } from '../models/modelProfile';
import { Statistics } from '../models/statistics';

export class StorageService {
    private context: vscode.ExtensionContext;
    private storageKey = 'tokenTrackerData';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    // Save data to extension context
    public async saveData(data: any): Promise<void> {
        await this.context.globalState.update(this.storageKey, data);
    }

    // Load data from extension context
    public async loadData(): Promise<any> {
        return this.context.globalState.get(this.storageKey, {});
    }

    // Backup database
    public async backup(): Promise<void> {
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
    public async restore(): Promise<void> {
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

    // Usage Records methods
    public async getUsageRecords(): Promise<UsageRecord[]> {
        return this.context.globalState.get<UsageRecord[]>('usageRecords', []);
    }

    public async addUsageRecord(record: UsageRecord): Promise<void> {
        const records = await this.getUsageRecords();
        records.push(record);
        await this.context.globalState.update('usageRecords', records);
    }

    public async clearUsageRecords(): Promise<void> {
        await this.context.globalState.update('usageRecords', []);
    }

    // Model Profile methods
    public async getModelProfiles(): Promise<ModelProfile[]> {
        const defaultProfiles: ModelProfile[] = [
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
        return this.context.globalState.get<ModelProfile[]>('modelProfiles', defaultProfiles);
    }

    public getCurrentModelProfile(): ModelProfile | undefined {
        const profiles = this.context.globalState.get<ModelProfile[]>('modelProfiles', []);
        return profiles.find(p => p.isActive) || profiles[0];
    }

    public getCurrentModelName(): string {
        // First, try to get the model name from the most recent usage record
        const usageRecords = this.context.globalState.get<UsageRecord[]>('usageRecords', []);
        if (usageRecords.length > 0) {
            // Get the most recent usage record (sorted by timestamp descending)
            const sortedRecords = [...usageRecords].sort((a, b) => b.timestamp - a.timestamp);
            const lastRecord = sortedRecords[0];
            if (lastRecord.model) {
                return lastRecord.model;
            }
        }
        
        // Fallback to active profile name if no usage records
        const profile = this.getCurrentModelProfile();
        if (profile && profile.name) {
            return profile.name;
        }
        
        // Final fallback to configuration value
        const config = vscode.workspace.getConfiguration('tokenTracker');
        return config.get<string>('currentModel', 'Unknown');
    }

    public async setActiveModelProfile(profileId: string): Promise<void> {
        const profiles = await this.getModelProfiles();
        const updatedProfiles = profiles.map(p => ({
            ...p,
            isActive: p.id === profileId
        }));
        await this.context.globalState.update('modelProfiles', updatedProfiles);
    }

    public async deleteModelProfile(profileId: string): Promise<void> {
        const profiles = await this.getModelProfiles();
        const updatedProfiles = profiles.filter(p => p.id !== profileId);
        await this.context.globalState.update('modelProfiles', updatedProfiles);
    }

    // Statistics methods
    public async getSessionStats(): Promise<Statistics> {
        return this.context.globalState.get<Statistics>('sessionStats', {
            requests: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            cost: 0
        });
    }

    public async getLifetimeStats(): Promise<Statistics> {
        return this.context.globalState.get<Statistics>('lifetimeStats', {
            requests: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            cost: 0
        });
    }

    public async updateSessionStats(delta: Partial<Statistics>): Promise<void> {
        const current = await this.getSessionStats();
        const updated: Statistics = {
            requests: current.requests + (delta.requests ?? 0),
            promptTokens: current.promptTokens + (delta.promptTokens ?? 0),
            completionTokens: current.completionTokens + (delta.completionTokens ?? 0),
            totalTokens: current.totalTokens + (delta.totalTokens ?? 0),
            cost: current.cost + (delta.cost ?? 0)
        };
        await this.context.globalState.update('sessionStats', updated);
    }

    public async setSessionStats(stats: Statistics): Promise<void> {
        await this.context.globalState.update('sessionStats', stats);
    }

    public async updateLifetimeStats(delta: Partial<Statistics>): Promise<void> {
        const current = await this.getLifetimeStats();
        const updated: Statistics = {
            requests: current.requests + (delta.requests ?? 0),
            promptTokens: current.promptTokens + (delta.promptTokens ?? 0),
            completionTokens: current.completionTokens + (delta.completionTokens ?? 0),
            totalTokens: current.totalTokens + (delta.totalTokens ?? 0),
            cost: current.cost + (delta.cost ?? 0)
        };
        await this.context.globalState.update('lifetimeStats', updated);
    }

    public async setLifetimeStats(stats: Statistics): Promise<void> {
        await this.context.globalState.update('lifetimeStats', stats);
    }

    // Public method to update global state (for import/export)
    public async updateGlobalState(key: string, value: any): Promise<void> {
        await this.context.globalState.update(key, value);
    }
}