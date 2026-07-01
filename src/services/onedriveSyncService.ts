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

export class OneDriveSyncService {
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
        console.log('[OneDriveSyncService] Constructor called, loading sync status and interval...');
        this.loadSyncStatus();
        this.loadSyncInterval();
    }
    
    public setSyncStatusChangedCallback(callback: (status: SyncStatus) => void): void {
        this.onSyncStatusChanged = callback;
        console.log('[OneDriveSyncService] Sync status changed callback set');
    }
    
    private loadSyncInterval(): void {
        const config = vscode.workspace.getConfiguration('tokenTracker');
        const interval = config.get<number>('syncInterval', 0);
        console.log(`[OneDriveSyncService] loadSyncInterval: interval = ${interval}`);
        if (interval > 0) {
            console.log(`[OneDriveSyncService] Starting auto-sync with interval ${interval} minutes`);
            this.startAutoSync(interval);
        } else {
            console.log('[OneDriveSyncService] Auto-sync is disabled (interval <= 0)');
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
        console.log(`[OneDriveSyncService] setSyncInterval: setting interval to ${interval}`);
        await vscode.workspace.getConfiguration('tokenTracker').update('syncInterval', interval, true);
        console.log('[OneDriveSyncService] Configuration updated, reloading...');
        
        if (this.autoSyncTimer) {
            clearTimeout(this.autoSyncTimer);
            this.autoSyncTimer = null;
        }
        
        if (interval > 0) {
            console.log(`[OneDriveSyncService] Starting auto-sync with interval ${interval} minutes`);
            this.startAutoSync(interval);
        } else {
            console.log('[OneDriveSyncService] Auto-sync disabled');
        }
    }
    
    private startAutoSync(intervalMinutes: number): void {
        const intervalMs = intervalMinutes * 60 * 1000;
        this.autoSyncTimer = setTimeout(async () => {
            await this.syncToOneDrive();
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
        const savedStatus = this.context.globalState.get<SyncStatus>('onedriveSyncStatus');
        if (savedStatus) {
            this.syncStatus = savedStatus;
        }
    }
    
    private saveSyncStatus(): void {
        this.context.globalState.update('onedriveSyncStatus', this.syncStatus);
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
    
    public async syncToOneDrive(): Promise<void> {
        const onedrivePath = this.getOneDrivePath();
        
        if (!onedrivePath) {
            await this.setSyncFailure('OneDrive path not configured. Please set it in the settings.');
            throw new Error('OneDrive path not configured');
        }
        
        try {
            // Ensure the sync directory exists
            if (!fs.existsSync(onedrivePath)) {
                fs.mkdirSync(onedrivePath, { recursive: true });
            }
            
            // Get all data to sync
            const data = await this.collectDataForSync();
            
            // Write data to OneDrive
            const syncFilePath = path.join(onedrivePath, 'token-tracker-sync.json');
            fs.writeFileSync(syncFilePath, JSON.stringify(data, null, 2));
            
            // Write sync status file
            const statusFilePath = path.join(onedrivePath, 'token-tracker-status.json');
            const statusData = {
                lastSync: new Date().toISOString(),
                success: true
            };
            fs.writeFileSync(statusFilePath, JSON.stringify(statusData, null, 2));
            
            await this.setSyncSuccess();
            vscode.window.showInformationMessage('Token Tracker: Data synced to OneDrive successfully');
        } catch (error) {
            await this.setSyncFailure(error instanceof Error ? error.message : String(error));
            vscode.window.showErrorMessage(`Token Tracker: Failed to sync to OneDrive: ${error}`);
            throw error;
        }
    }
    
    public async syncFromOneDrive(): Promise<void> {
        const onedrivePath = this.getOneDrivePath();
        
        if (!onedrivePath) {
            await this.setSyncFailure('OneDrive path not configured. Please set it in the settings.');
            throw new Error('OneDrive path not configured');
        }
        
        try {
            const syncFilePath = path.join(onedrivePath, 'token-tracker-sync.json');
            
            if (!fs.existsSync(syncFilePath)) {
                await this.setSyncFailure('No sync file found in OneDrive');
                throw new Error('No sync file found in OneDrive');
            }
            
            const data = JSON.parse(fs.readFileSync(syncFilePath, 'utf8'));
            
            // Restore data from sync file
            await this.restoreDataFromSync(data);
            
            await this.setSyncSuccess();
            vscode.window.showInformationMessage('Token Tracker: Data restored from OneDrive successfully');
        } catch (error) {
            await this.setSyncFailure(error instanceof Error ? error.message : String(error));
            vscode.window.showErrorMessage(`Token Tracker: Failed to restore from OneDrive: ${error}`);
            throw error;
        }
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
    
    private getOneDrivePath(): string | null {
        // Check for user-configured OneDrive path
        const config = vscode.workspace.getConfiguration('tokenTracker');
        let onedrivePath = config.get<string>('onedrivePath', '');
        
        if (onedrivePath) {
            // Unescape backslashes for proper path usage
            onedrivePath = onedrivePath.replace(/\\\\/g, '\\');
            return onedrivePath;
        }
        
        // Try to detect common OneDrive paths
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        
        const commonPaths = [
            path.join(homeDir, 'OneDrive'),
            path.join(homeDir, 'OneDrive - Personal'),
            path.join(homeDir, 'OneDrive - Work'),
            path.join(homeDir, 'OneDrive - School'),
            path.join(homeDir, 'Documents', 'OneDrive')
        ];
        
        for (const p of commonPaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }
        
        return null;
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
