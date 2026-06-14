import * as vscode from 'vscode';
import axios from 'axios';

export class LlamaCppClient {
    private serverUrl: string;
    private timeoutMs: number;
    
    constructor(serverUrl: string, timeoutMs: number) {
        this.serverUrl = serverUrl;
        this.timeoutMs = timeoutMs;
    }
    
    async getMetrics(): Promise<any> {
        try {
            const response = await axios.get(`${this.serverUrl}/metrics`, {
                timeout: this.timeoutMs
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching metrics:', error);
            return null;
        }
    }
    
    async getStats(): Promise<any> {
        try {
            const response = await axios.get(`${this.serverUrl}/stats`, {
                timeout: this.timeoutMs
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching stats:', error);
            return null;
        }
    }
    
    async getHealth(): Promise<any> {
        try {
            const response = await axios.get(`${this.serverUrl}/health`, {
                timeout: this.timeoutMs
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching health:', error);
            return null;
        }
    }
    
    async sendRequest(requestData: any): Promise<any> {
        try {
            const response = await axios.post(this.serverUrl, requestData, {
                timeout: this.timeoutMs
            });
            return response.data;
        } catch (error) {
            console.error('Error sending request:', error);
            throw error;
        }
    }
}