import * as fs from 'fs';
import * as vscode from 'vscode';
import { StorageService } from './storageService';
import { StatisticsService } from './statisticsService';

export class LlamaCppUsageMonitor {
    private logPath: string;
    private fileHandle: fs.promises.FileHandle | null = null;
    private watcher: fs.FSWatcher | null = null;
    private storageService: StorageService | null = null;
    private statisticsService: StatisticsService | null = null;
    private isMonitoring: boolean = false;
    
    constructor(logPath: string) {
        this.logPath = logPath;
        
        // Initialize services - pass context from extension
        const ext = vscode.extensions.getExtension('felix.token-cost-tracker');
        if (ext) {
            // Note: extensionContext is not directly accessible, services should be injected
            this.storageService = null;
            this.statisticsService = null;
        }
    }

    public setServices(storageService: StorageService, statisticsService: StatisticsService) {
        this.storageService = storageService;
        this.statisticsService = statisticsService;
    }
    
    async start(): Promise<void> {
        if (this.isMonitoring) return;
        
        try {
            // Open file for reading
            this.fileHandle = await fs.promises.open(this.logPath, 'r');
            
            // Get file size to start from the end
            const stats = await this.fileHandle.stat();
            const fileSize = stats.size;
            
            // Seek to end of file using read with position
            // Note: fs.promises.FileHandle doesn't have seek method in older Node versions
            // We'll track position manually
            
            // Watch file for changes
            this.watcher = fs.watch(this.logPath, async () => {
                await this.processNewLogLines();
            });
            
            this.isMonitoring = true;
            console.log(`Started monitoring log file: ${this.logPath}`);
        } catch (error) {
            console.error('Error starting log monitoring:', error);
            vscode.window.showErrorMessage(`Failed to start log monitoring: ${error}`);
        }
    }
    
    stop(): void {
        if (!this.isMonitoring) return;
        
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        
        if (this.fileHandle) {
            this.fileHandle.close();
            this.fileHandle = null;
        }
        
        this.isMonitoring = false;
        console.log(`Stopped monitoring log file: ${this.logPath}`);
    }
    
    private async processNewLogLines(): Promise<void> {
        if (!this.fileHandle || !this.storageService || !this.statisticsService) return;
        
        try {
            // Read new content from current position
            const buffer = Buffer.alloc(1024);
            const { bytesRead } = await this.fileHandle.read(buffer, 0, 1024, null);
            
            if (bytesRead > 0) {
                const content = buffer.toString('utf8', 0, bytesRead);
                const lines = content.split('\n');
                
                // Process each line for token usage
                for (const line of lines) {
                    const usage = this.extractUsageFromLine(line);
                    if (usage) {
                        // Save usage record
                        const record = {
                            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                            timestamp: Date.now(),
                            model: usage.model || 'Unknown Model',
                            promptTokens: usage.promptTokens,
                            completionTokens: usage.completionTokens,
                            totalTokens: usage.totalTokens,
                            cost: usage.cost
                        };
                        
                        await this.storageService.addUsageRecord(record);
                        
                        // Update statistics
                        await this.statisticsService.updateStats(
                            usage.promptTokens,
                            usage.completionTokens,
                            usage.totalTokens,
                            usage.cost
                        );
                    }
                }
            }
        } catch (error) {
            console.error('Error processing log lines:', error);
        }
    }
    
    private extractUsageFromLine(line: string): {
        model: string;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        cost: number;
    } | null {
        // Look for token usage patterns in log line
        // Example patterns:
        // "tokens_evaluated": 1245, "tokens_predicted": 312
        // "prompt_tokens": 1245, "completion_tokens": 312
        
        // Extract tokens_evaluated and tokens_predicted
        const tokensEvaluatedMatch = line.match(/"tokens_evaluated":\s*(\d+)/);
        const tokensPredictedMatch = line.match(/"tokens_predicted":\s*(\d+)/);
        
        if (tokensEvaluatedMatch && tokensPredictedMatch) {
            const promptTokens = parseInt(tokensEvaluatedMatch[1]);
            const completionTokens = parseInt(tokensPredictedMatch[1]);
            
            return {
                model: 'Unknown Model', // Can't extract model from log line
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
                cost: 0 // Cost will be calculated by pricing service
            };
        }
        
        // Extract prompt_tokens and completion_tokens
        const promptTokensMatch = line.match(/"prompt_tokens":\s*(\d+)/);
        const completionTokensMatch = line.match(/"completion_tokens":\s*(\d+)/);
        
        if (promptTokensMatch && completionTokensMatch) {
            const promptTokens = parseInt(promptTokensMatch[1]);
            const completionTokens = parseInt(completionTokensMatch[1]);
            
            return {
                model: 'Unknown Model', // Can't extract model from log line
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
                cost: 0 // Cost will be calculated by pricing service
            };
        }
        
        // No usage found
        return null;
    }
}