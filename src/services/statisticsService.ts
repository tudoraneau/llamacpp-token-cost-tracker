import * as vscode from 'vscode';
import { StorageService } from './storageService';
import { Statistics } from '../models/statistics';

export class StatisticsService {
    private storageService: StorageService;
    private listeners: Array<() => void>;
    
    constructor(storageService: StorageService) {
        this.storageService = storageService;
        this.listeners = [];
    }
    
    async updateStats(promptTokens: number, completionTokens: number, totalTokens: number, cost: number): Promise<void> {
        // Update session stats
        await this.storageService.updateSessionStats({
            requests: 1,
            promptTokens,
            completionTokens,
            totalTokens,
            cost
        });
        
        // Update lifetime stats
        await this.storageService.updateLifetimeStats({
            requests: 1,
            promptTokens,
            completionTokens,
            totalTokens,
            cost
        });
        
        // Notify listeners
        this.listeners.forEach(listener => listener());
    }
    
    async resetSession(): Promise<void> {
        await this.storageService.updateSessionStats({
            requests: 0,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            cost: 0
        });
        
        // Notify listeners
        this.listeners.forEach(listener => listener());
    }
    
    getSessionStats(): Promise<Statistics> {
        return this.storageService.getSessionStats();
    }
    
    getLifetimeStats(): Promise<Statistics> {
        return this.storageService.getLifetimeStats();
    }
    
    onStatsChanged(callback: () => void): void {
        this.listeners.push(callback);
    }
}