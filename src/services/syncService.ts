import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface SyncStatus {
    lastSync: string | null;
    lastSyncSuccess: boolean;
    lastSyncError: string | null;
}

export type SyncInterval = 1 | 5 | 10 | 15 | 30 | 0;

export const SYNC_INTERVALS: { label: string; value: SyncInterval }[] = [
    { label: '1 min', value: 1 },
    { label: '5 min', value: 5 },
    { label: '10 min', value: 10 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: 'Disabled', value: 0 }
];

export class SyncService {
    private context: vscode.ExtensionContext;
    private syncStatus: SyncStatus = {
        lastSync: null,
        lastSyncSuccess: false,
        lastSyncError: null
    };
    private autoSyncTimer: NodeJS.Timeout | null = null;
    private onSyncStatusChanged?: (status: SyncStatus) => void;
    
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        console.log('[SyncService] Constructor called, loading sync status and interval...');
        this.loadSyncStatus();
        this.loadSyncInterval();
    }
    
    public setSyncStatusChangedCallback(callback: (status: SyncStatus) => void): void {
        this.onSyncStatusChanged = callback;
        console.log('[SyncService] Sync status changed callback set');
    }
    
    private loadSyncInterval(): void {
        const config = vscode.workspace.getConfiguration('tokenTracker');
        const interval = config.get<number>('syncInterval', 0);
        console.log(`[SyncService] loadSyncInterval: interval = ${interval}`);
        if (interval > 0) {
            console.log(`[SyncService] Starting auto-sync with interval ${interval} minutes`);
            this.startAutoSync(interval);
        } else {
            console.log('[SyncService] Auto-sync is disabled (interval <= 0)');
        }
    }
    
    public getSyncIntervals(): { label: string; value: number }[] {
        return SYNC_INTERVALS;
    }
    
    public getSyncInterval(): number {
        const config = vscode.workspace.getConfiguration('tokenTracker');
        return config.get<number>('syncInterval', 0);
    }
    
    public async setSyncInterval(interval: number): Promise<void> {
        console.log(`[SyncService] setSyncInterval: setting interval to ${interval}`);
        await vscode.workspace.getConfiguration('tokenTracker').update('syncInterval', interval, true);
        console.log('[SyncService] Configuration updated, reloading...');
        
        if (this.autoSyncTimer) {
            clearTimeout(this.autoSyncTimer);
            this.autoSyncTimer = null;
        }
        
        if (interval > 0) {
            console.log(`[SyncService] Starting auto-sync with interval ${interval} minutes`);
            this.startAutoSync(interval);
        } else {
            console.log('[SyncService] Auto-sync disabled');
        }
    }
    
    private startAutoSync(intervalMinutes: number): void {
        const intervalMs = intervalMinutes * 60 * 1000;
        this.autoSyncTimer = setTimeout(async () => {
            await this.sync();
            this.startAutoSync(intervalMinutes);
        }, intervalMs);
    }
    
    public stopAutoSync(): void {
        if (this.autoSyncTimer) {
            clearTimeout(this.autoSyncTimer);
            this.autoSyncTimer = null;
        }
    }
    
    private loadSyncStatus(): void {
        const savedStatus = this.context.globalState.get<SyncStatus>('syncStatus');
        if (savedStatus) {
            this.syncStatus = savedStatus;
        }
    }
    
    private saveSyncStatus(): void {
        this.context.globalState.update('syncStatus', this.syncStatus);
    }
    
    public getSyncStatus(): SyncStatus {
        return this.syncStatus;
    }
    
    public async setSyncSuccess(): Promise<void> {
        this.syncStatus.lastSync = new Date().toISOString();
        this.syncStatus.lastSyncSuccess = true;
        this.syncStatus.lastSyncError = null;
        this.saveSyncStatus();
        if (this.onSyncStatusChanged) {
            this.onSyncStatusChanged(this.syncStatus);
        }
    }
    
    public async setSyncFailure(error: string): Promise<void> {
        this.syncStatus.lastSync = new Date().toISOString();
        this.syncStatus.lastSyncSuccess = false;
        this.syncStatus.lastSyncError = error;
        this.saveSyncStatus();
        if (this.onSyncStatusChanged) {
            this.onSyncStatusChanged(this.syncStatus);
        }
    }
    
    public async sync(): Promise<void> {
        const syncFilePath = this.getSyncFilePath();
        
        if (!syncFilePath) {
            await this.setSyncFailure('Sync path not configured. Please set it in the settings.');
            throw new Error('Sync path not configured');
        }
        
        try {
            // Ensure the directory containing the sync file exists
            const dirPath = path.dirname(syncFilePath);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
            
            // Get all data to sync
            const data = await this.collectDataForSync();
            
            // Write data to the sync file
            fs.writeFileSync(syncFilePath, JSON.stringify(data, null, 2));
            
            // Write sync status file (next to the sync file)
            const statusFilePath = syncFilePath.replace(/\.json$/, '-status.json');
            const statusData = {
                lastSync: new Date().toISOString(),
                success: true
            };
            fs.writeFileSync(statusFilePath, JSON.stringify(statusData, null, 2));
            
            await this.setSyncSuccess();
            vscode.window.showInformationMessage('Token Tracker: Data synced successfully');
        } catch (error) {
            await this.setSyncFailure(error instanceof Error ? error.message : String(error));
            vscode.window.showErrorMessage(`Token Tracker: Failed to sync: ${error}`);
            throw error;
        }
    }
    
    public async restore(): Promise<void> {
        const syncFilePath = this.getSyncFilePath();
        
        if (!syncFilePath) {
            await this.setSyncFailure('Sync path not configured. Please set it in the settings.');
            throw new Error('Sync path not configured');
        }
        
        try {
            if (!fs.existsSync(syncFilePath)) {
                await this.setSyncFailure('No sync file found at specified path');
                throw new Error('No sync file found at specified path');
            }
            
            const data = JSON.parse(fs.readFileSync(syncFilePath, 'utf8'));
            
            // Restore data from sync file
            await this.restoreDataFromSync(data);
            
            await this.setSyncSuccess();
            vscode.window.showInformationMessage('Token Tracker: Data restored successfully');
        } catch (error) {
            await this.setSyncFailure(error instanceof Error ? error.message : String(error));
            vscode.window.showErrorMessage(`Token Tracker: Failed to restore: ${error}`);
            throw error;
        }
    }
    
    private getSyncFilePath(): string | null {
        // Get the user-configured sync file path
        const config = vscode.workspace.getConfiguration('tokenTracker');
        const syncFilePath = config.get<string>('syncPath', '');
        return syncFilePath || null;
    }
    
    private async collectDataForSync(): Promise<any> {
        // Collect all data that is stored locally for the extension
        const usageRecords = await this.context.globalState.get<UsageRecord[]>('usageRecords', []);
        const modelProfiles = await this.context.globalState.get<ModelProfile[]>('modelProfiles', []);
        const sessionStats = await this.context.globalState.get<Statistics>('sessionStats', {
            requests: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            cost: 0
        });
        const lifetimeStats = await this.context.globalState.get<Statistics>('lifetimeStats', {
            requests: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            cost: 0
        });
        
        return {
            usageRecords,
            modelProfiles,
            sessionStats,
            lifetimeStats,
            syncVersion: '1.0'
        };
    }
    
    private async restoreDataFromSync(data: any): Promise<void> {
        // Restore all data from sync file
        if (data.usageRecords) {
            await this.context.globalState.update('usageRecords', data.usageRecords);
        }
        if (data.modelProfiles) {
            await this.context.globalState.update('modelProfiles', data.modelProfiles);
        }
        if (data.sessionStats) {
            await this.context.globalState.update('sessionStats', data.sessionStats);
        }
        if (data.lifetimeStats) {
            await this.context.globalState.update('lifetimeStats', data.lifetimeStats);
        }
    }
    
    public getSyncIntervalLabel(interval: number): string {
        const syncInterval = SYNC_INTERVALS.find(i => i.value === interval);
        return syncInterval ? syncInterval.label : 'Disabled';
    }
}

// Type imports
import { UsageRecord } from '../models/usageRecord';
import { ModelProfile } from '../models/modelProfile';
import { Statistics } from '../models/statistics';
