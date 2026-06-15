import axios from 'axios';
import { StorageService } from './storageService';
import { StatisticsService } from './statisticsService';
import { PricingService } from './pricingService';
export class LlamaCppClient {
    private serverUrl: string;
    private timeoutMs: number;
    private storageService: StorageService | null = null;
    private statisticsService: StatisticsService | null = null;
    private pricingService: PricingService | null = null;
    
    constructor(serverUrl: string, timeoutMs: number) {
        this.serverUrl = serverUrl;
        this.timeoutMs = timeoutMs;
    }
    
    public setServices(
        storageService: StorageService,
        statisticsService: StatisticsService,
        pricingService: PricingService
    ): void {
        this.storageService = storageService;
        this.statisticsService = statisticsService;
        this.pricingService = pricingService;
    }

    updateConfig(serverUrl: string, timeoutMs: number): void {
        this.serverUrl = serverUrl;
        this.timeoutMs = timeoutMs;
    }

    private async trackResponse(responseData: any): Promise<void> {
        if (!this.statisticsService) return;

        const usage = this.extractUsage(responseData);
        if (!usage) return;

        const cost = this.pricingService
            ? this.pricingService.calculateCost(usage.promptTokens, usage.completionTokens)
            : 0;

        if (this.storageService) {
            await this.storageService.addUsageRecord({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                timestamp: Date.now(),
                model: usage.model || 'Unknown Model',
                promptTokens: usage.promptTokens,
                completionTokens: usage.completionTokens,
                totalTokens: usage.totalTokens,
                cost: cost
            });
        }

        await this.statisticsService.updateStats(
            usage.promptTokens,
            usage.completionTokens,
            usage.totalTokens,
            cost
        );

        console.log(`[TokenTracker] Tracked: ${usage.totalTokens} tokens (${usage.promptTokens} prompt, ${usage.completionTokens} completion)`);
    }
    
    private extractUsage(data: any): { model: string; promptTokens: number; completionTokens: number; totalTokens: number } | null {
        if (!data) return null;

        // OpenAI-compatible usage object
        if (data.usage) {
            const promptTokens = data.usage.prompt_tokens ?? data.usage.promptTokens ?? 0;
            const completionTokens = data.usage.completion_tokens ?? data.usage.completionTokens ?? 0;
            const totalTokens = data.usage.total_tokens ?? data.usage.totalTokens ?? (promptTokens + completionTokens);

            if (totalTokens > 0) {
                return {
                    model: data.model || 'Unknown',
                    promptTokens,
                    completionTokens,
                    totalTokens
                };
            }
        }

        // llama.cpp native format
        if (data.tokens_evaluated !== undefined && data.tokens_predicted !== undefined) {
            return {
                model: data.model || 'Unknown',
                promptTokens: data.tokens_evaluated,
                completionTokens: data.tokens_predicted,
                totalTokens: data.tokens_evaluated + data.tokens_predicted
            };
        }

        // Direct fields
        if (data.prompt_tokens !== undefined && data.completion_tokens !== undefined) {
            return {
                model: data.model || 'Unknown',
                promptTokens: data.prompt_tokens,
                completionTokens: data.completion_tokens,
                totalTokens: data.prompt_tokens + data.completion_tokens
            };
        }

        return null;
    }
    
    async getMetrics(): Promise<any> {
        try {
            const response = await axios.get(`${this.serverUrl}/metrics`, { timeout: this.timeoutMs });
            return response.data;
        } catch (error) {
            console.error('[TokenTracker] Error fetching metrics:', error);
            return null;
        }
    }

    async getStats(): Promise<any> {
        try {
            const response = await axios.get(`${this.serverUrl}/stats`, { timeout: this.timeoutMs });
            return response.data;
        } catch (error) {
            console.error('[TokenTracker] Error fetching stats:', error);
            return null;
        }
    }

    async getHealth(): Promise<any> {
        try {
            const response = await axios.get(`${this.serverUrl}/health`, { timeout: this.timeoutMs });
            return response.data;
        } catch (error) {
            console.error('[TokenTracker] Error fetching health:', error);
            return null;
        }
    }

    async sendRequest(requestData: any): Promise<any> {
        try {
            const response = await axios.post(this.serverUrl, requestData, { timeout: this.timeoutMs });

            // Track token usage from response
            await this.trackResponse(response.data);

            return response.data;
        } catch (error) {
            console.error('[TokenTracker] Error sending request:', error);
            throw error;
        }
    }

    async isConnected(): Promise<boolean> {
        try {
            await this.getHealth();
            return true;
        } catch {
            return false;
        }
    }
}
