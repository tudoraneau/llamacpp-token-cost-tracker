import * as http from 'http';
import * as vscode from 'vscode';
import axios from 'axios';
import { StorageService } from './storageService';
import { StatisticsService } from './statisticsService';
import { PricingService } from './pricingService';

export class LlamaCppProxy {
    private server: http.Server;
    private port: number;
    private targetUrl: string;
    private storageService: StorageService | null = null;
    private statisticsService: StatisticsService | null = null;
    private pricingService: PricingService | null = null;
    
    constructor(port: number, targetUrl: string) {
        this.port = port;
        this.targetUrl = targetUrl;
        this.server = http.createServer(this.handleRequest.bind(this));
    }
    
    public setServices(
        storageService: StorageService, 
        statisticsService: StatisticsService,
        pricingService: PricingService
    ) {
        this.storageService = storageService;
        this.statisticsService = statisticsService;
        this.pricingService = pricingService;
    }
    
    async start(): Promise<void> {
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(`Token Tracker Proxy listening on port ${this.port}`);
                resolve();
            });
        });
    }
    
    stop(): void {
        this.server.close();
        console.log('Token Tracker Proxy stopped');
    }
    
    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        // Forward request to llama.cpp server
        try {
            const requestData = await this.collectRequestData(req);
            
            // Forward request to target server
            const targetResponse = await axios.post(this.targetUrl, requestData, {
                headers: req.headers,
                timeout: 5000,
                responseType: 'json'
            });
            
            // Extract and track token usage from response
            await this.trackTokenUsage(targetResponse.data);
            
            // Send response back to client
            res.writeHead(targetResponse.status, targetResponse.headers);
            res.end(JSON.stringify(targetResponse.data));
        } catch (error) {
            console.error('Error in proxy:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }
    
    private async trackTokenUsage(responseData: any): Promise<void> {
        if (!this.statisticsService) return;
        
        try {
            // Extract token usage from response
            const usage = this.extractUsageFromResponse(responseData);
            
            if (usage) {
                // Calculate cost if pricing service is available
                const cost = this.pricingService 
                    ? this.pricingService.calculateCost(usage.promptTokens, usage.completionTokens)
                    : 0;
                
                // Save usage record if storage service is available
                if (this.storageService) {
                    const record = {
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                        timestamp: Date.now(),
                        model: usage.model || 'Unknown Model',
                        promptTokens: usage.promptTokens,
                        completionTokens: usage.completionTokens,
                        totalTokens: usage.totalTokens,
                        cost: cost
                    };
                    
                    await this.storageService.addUsageRecord(record);
                }
                
                // Update statistics
                await this.statisticsService.updateStats(
                    usage.promptTokens,
                    usage.completionTokens,
                    usage.totalTokens,
                    cost
                );
                
                console.log(`Tracked token usage: ${usage.totalTokens} tokens (${usage.promptTokens} prompt, ${usage.completionTokens} completion)`);
            }
        } catch (error) {
            console.error('Error tracking token usage:', error);
        }
    }
    
    private extractUsageFromResponse(responseData: any): {
        model: string;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    } | null {
        if (!responseData) return null;
        
        // Try to extract from usage object (common in OpenAI-compatible APIs)
        if (responseData.usage) {
            const usage = responseData.usage;
            const promptTokens = usage.prompt_tokens || usage.promptTokens || 0;
            const completionTokens = usage.completion_tokens || usage.completionTokens || 0;
            const totalTokens = usage.total_tokens || usage.totalTokens || (promptTokens + completionTokens);
            
            if (totalTokens > 0) {
                return {
                    model: responseData.model || 'Unknown Model',
                    promptTokens,
                    completionTokens,
                    totalTokens
                };
            }
        }
        
        // Try to extract from tokens_evaluated and tokens_predicted (llama.cpp specific)
        if (responseData.tokens_evaluated !== undefined && responseData.tokens_predicted !== undefined) {
            const promptTokens = responseData.tokens_evaluated;
            const completionTokens = responseData.tokens_predicted;
            
            return {
                model: responseData.model || 'Unknown Model',
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens
            };
        }
        
        // Try direct prompt_tokens and completion_tokens fields
        if (responseData.prompt_tokens !== undefined && responseData.completion_tokens !== undefined) {
            return {
                model: responseData.model || 'Unknown Model',
                promptTokens: responseData.prompt_tokens,
                completionTokens: responseData.completion_tokens,
                totalTokens: responseData.prompt_tokens + responseData.completion_tokens
            };
        }
        
        return null;
    }
    
    private async collectRequestData(req: http.IncomingMessage): Promise<any> {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const parsedData = JSON.parse(body);
                    resolve(parsedData);
                } catch (e) {
                    resolve(body);
                }
            });
            req.on('error', reject);
        });
    }
}
