"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatisticsService = void 0;
class StatisticsService {
    constructor(storageService) {
        this.storageService = storageService;
        this.listeners = [];
    }
    async updateStats(promptTokens, completionTokens, totalTokens, cost) {
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
    async resetSession() {
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
    getSessionStats() {
        return this.storageService.getSessionStats();
    }
    getLifetimeStats() {
        return this.storageService.getLifetimeStats();
    }
    onStatsChanged(callback) {
        this.listeners.push(callback);
    }
}
exports.StatisticsService = StatisticsService;
//# sourceMappingURL=statisticsService.js.map