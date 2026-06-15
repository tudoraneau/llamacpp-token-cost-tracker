"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlamaCppClient = void 0;
const axios_1 = __importDefault(require("axios"));
class LlamaCppClient {
    constructor(serverUrl, timeoutMs) {
        this.storageService = null;
        this.statisticsService = null;
        this.pricingService = null;
        this.serverUrl = serverUrl;
        this.timeoutMs = timeoutMs;
    }
    setServices(storageService, statisticsService, pricingService) {
        this.storageService = storageService;
        this.statisticsService = statisticsService;
        this.pricingService = pricingService;
    }
    updateConfig(serverUrl, timeoutMs) {
        this.serverUrl = serverUrl;
        this.timeoutMs = timeoutMs;
    }
    async trackResponse(responseData) {
        if (!this.statisticsService)
            return;
        const usage = this.extractUsage(responseData);
        if (!usage)
            return;
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
        await this.statisticsService.updateStats(usage.promptTokens, usage.completionTokens, usage.totalTokens, cost);
        console.log(`[TokenTracker] Tracked: ${usage.totalTokens} tokens (${usage.promptTokens} prompt, ${usage.completionTokens} completion)`);
    }
    extractUsage(data) {
        if (!data)
            return null;
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
    async getMetrics() {
        try {
            const response = await axios_1.default.get(`${this.serverUrl}/metrics`, { timeout: this.timeoutMs });
            return response.data;
        }
        catch (error) {
            console.error('[TokenTracker] Error fetching metrics:', error);
            return null;
        }
    }
    async getStats() {
        try {
            const response = await axios_1.default.get(`${this.serverUrl}/stats`, { timeout: this.timeoutMs });
            return response.data;
        }
        catch (error) {
            console.error('[TokenTracker] Error fetching stats:', error);
            return null;
        }
    }
    async getHealth() {
        try {
            const response = await axios_1.default.get(`${this.serverUrl}/health`, { timeout: this.timeoutMs });
            return response.data;
        }
        catch (error) {
            console.error('[TokenTracker] Error fetching health:', error);
            return null;
        }
    }
    async sendRequest(requestData) {
        try {
            const response = await axios_1.default.post(this.serverUrl, requestData, { timeout: this.timeoutMs });
            // Track token usage from response
            await this.trackResponse(response.data);
            return response.data;
        }
        catch (error) {
            console.error('[TokenTracker] Error sending request:', error);
            throw error;
        }
    }
    async isConnected() {
        try {
            await this.getHealth();
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.LlamaCppClient = LlamaCppClient;
//# sourceMappingURL=llamaCppClient.js.map