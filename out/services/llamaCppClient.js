"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlamaCppClient = void 0;
const axios_1 = __importDefault(require("axios"));
class LlamaCppClient {
    constructor(serverUrl, timeoutMs) {
        this.serverUrl = serverUrl;
        this.timeoutMs = timeoutMs;
    }
    updateConfig(serverUrl, timeoutMs) {
        this.serverUrl = serverUrl;
        this.timeoutMs = timeoutMs;
    }
    async getMetrics() {
        try {
            const response = await axios_1.default.get(`${this.serverUrl}/metrics`, {
                timeout: this.timeoutMs
            });
            return response.data;
        }
        catch (error) {
            console.error('Error fetching metrics:', error);
            return null;
        }
    }
    async getStats() {
        try {
            const response = await axios_1.default.get(`${this.serverUrl}/stats`, {
                timeout: this.timeoutMs
            });
            return response.data;
        }
        catch (error) {
            console.error('Error fetching stats:', error);
            return null;
        }
    }
    async getHealth() {
        try {
            const response = await axios_1.default.get(`${this.serverUrl}/health`, {
                timeout: this.timeoutMs
            });
            return response.data;
        }
        catch (error) {
            console.error('Error fetching health:', error);
            return null;
        }
    }
    async sendRequest(requestData) {
        try {
            const response = await axios_1.default.post(this.serverUrl, requestData, {
                timeout: this.timeoutMs
            });
            return response.data;
        }
        catch (error) {
            console.error('Error sending request:', error);
            throw error;
        }
    }
}
exports.LlamaCppClient = LlamaCppClient;
//# sourceMappingURL=llamaCppClient.js.map