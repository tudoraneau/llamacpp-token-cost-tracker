import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
import { StorageService } from './storageService';
import { StatisticsService } from './statisticsService';
import { PricingService } from './pricingService';

export class LlamaCppProxy {
    private server: http.Server;
    private port: number;
    private targetBaseUrl: string;
    private storageService: StorageService | null = null;
    private statisticsService: StatisticsService | null = null;
    private pricingService: PricingService | null = null;
    private running = false;

    constructor(port: number, targetBaseUrl: string) {
        this.port = port;
        this.targetBaseUrl = targetBaseUrl.replace(/\/$/, '');
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
        if (this.running) return;
        return new Promise((resolve, reject) => {
            console.log(`[TokenTracker] Starting proxy on port ${this.port} -> ${this.targetBaseUrl}`);
            this.server.listen(this.port, '0.0.0.0', () => {
                console.log(`[TokenTracker] Proxy listening on port ${this.port} -> ${this.targetBaseUrl}`);
                this.running = true;
                resolve();
            });
            this.server.on('error', (err) => {
                console.error('[TokenTracker] Proxy server error:', err);
                reject(err);
            });
        });
    }
    
    stop(): Promise<void> {
        if (!this.running) return Promise.resolve();
        return new Promise((resolve) => {
            this.server.close(() => {
                console.log('[TokenTracker] Proxy stopped');
                this.running = false;
                resolve();
            });
        });
    }

    updateTarget(newTargetBaseUrl: string): void {
        this.targetBaseUrl = newTargetBaseUrl.replace(/\/$/, '');
        console.log(`[TokenTracker] Proxy target updated to: ${this.targetBaseUrl}`);
    }

    getProxyUrl(): string {
        return `http://localhost:${this.port}`;
    }
    
    isRunning(): boolean {
        return this.running;
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        // Parse the incoming request URL properly
        // req.url contains the path only (e.g., "/v1/chat/completions")
        const requestPath = req.url?.startsWith('/') ? req.url : `/${req.url}`;
        
        // Extract the path from the request URL
        // The path is everything after the host:port in the full URL
        let targetPath = requestPath;
        
        console.log(`[TokenTracker] Proxy received: ${req.method} ${req.url}`);
        console.log(`[TokenTracker] Target path: ${targetPath}`);

        // Construct target URL - change port from 8081 to 8080, keep /v1 path
        // The targetBaseUrl should be http://thor:8080 (without /v1)
        // The request path includes /v1, so we need to append it directly
        const targetUrl = `${this.targetBaseUrl}${targetPath}`;

        console.log(`[TokenTracker] Proxy forwarding to: ${targetUrl}`);
        console.log(`[TokenTracker] Request headers: ${JSON.stringify(req.headers)}`);

        try {
            const body = await this.collectBody(req);

            const options = {
                method: req.method,
                headers: { ...req.headers, host: new URL(this.targetBaseUrl).host },
                timeout: 120000, // 2 minute timeout for long completions
            };

            const isStreaming = this.isStreamingRequest(body);

            if (isStreaming) {
                await this.handleStreamingRequest(req, res, targetUrl, body);
            } else {
                await this.handleNonStreamingRequest(req, res, targetUrl, body);
            }
        } catch (error) {
            console.error('[TokenTracker] Proxy error:', error);
            if (!res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Proxy error', details: String(error) }));
            }
        }
    }
    
    private async handleNonStreamingRequest(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        targetUrl: string,
        body: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const isHttps = targetUrl.startsWith('https');
            const lib = isHttps ? https : http;

            const targetReq = lib.request(targetUrl, {
                method: req.method,
                headers: { ...req.headers, host: new URL(this.targetBaseUrl).host, 'content-length': Buffer.byteLength(body) },
            }, (targetRes) => {
                const chunks: Buffer[] = [];
                targetRes.on('data', (chunk: Buffer) => chunks.push(chunk));
                targetRes.on('end', async () => {
                    const responseBody = Buffer.concat(chunks).toString();
                    console.log(`[TokenTracker] Proxy received response: ${responseBody.substring(0, 500)}${responseBody.length > 500 ? '...' : ''}`);
                    
                    let parsed: any = null;
                    try {
                        parsed = JSON.parse(responseBody);
                        console.log(`[TokenTracker] Proxy parsed response: ${JSON.stringify(parsed)}`);
                    } catch (err) {
                        console.log(`[TokenTracker] Proxy response is not JSON: ${responseBody.substring(0, 100)}`);
                    }

                    await this.trackTokenUsage(parsed);

                    res.writeHead(targetRes.statusCode ?? 200, targetRes.headers);
                    res.end(responseBody);
                    resolve();
                });
                targetRes.on('error', (err) => {
                    console.error('[TokenTracker] Target response error:', err.message);
                    reject(err);
                });
            });

            targetReq.on('error', (err) => {
                console.error('[TokenTracker] Target request error:', err.message);
                console.error('[TokenTracker] Target URL:', targetUrl);
                reject(err);
            });
            if (body) targetReq.write(body);
            targetReq.end();
        });
    }

    private async handleStreamingRequest(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        targetUrl: string,
        body: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const isHttps = targetUrl.startsWith('https');
            const lib = isHttps ? https : http;

            let cumulativePromptTokens = 0;
            let cumulativeCompletionTokens = 0;
            let model = 'Unknown Model';
            let tracked = false;

            const targetReq = lib.request(targetUrl, {
                method: req.method,
                headers: { ...req.headers, host: new URL(this.targetBaseUrl).host, 'content-length': Buffer.byteLength(body) },
            }, (targetRes) => {
                // Forward streaming headers
                res.writeHead(targetRes.statusCode ?? 200, {
                    ...targetRes.headers,
                    'content-type': 'text/event-stream',
                    'cache-control': 'no-cache',
                    connection: 'keep-alive',
                });

                targetRes.on('data', async (chunk: Buffer) => {
                    const text = chunk.toString();
                    const lines = text.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6);
                            if (dataStr === '[DONE]') {
                                res.write('data: [DONE]\n\n');
                                continue;
                            }
                            try {
                                const parsed = JSON.parse(dataStr);
                                const usage = this.extractUsageFromResponse(parsed);
                                if (usage) {
                                    model = usage.model || model;
                                    cumulativePromptTokens = usage.promptTokens || cumulativePromptTokens;
                                    cumulativeCompletionTokens += usage.completionTokens || 0;
                                }
                                // Also count each chunk as 1 completion token if no usage info
                                if (parsed.content || parsed.choices?.[0]?.delta?.content) {
                                    cumulativeCompletionTokens += 1;
                                }
                            } catch { /* not json, pass through */ }
                        }
                        res.write(line + '\n');
                    }
                });

                targetRes.on('end', async () => {
                    if (!tracked && (cumulativePromptTokens > 0 || cumulativeCompletionTokens > 0)) {
                        tracked = true;
                        await this.trackTokenUsage({
                            usage: {
                                prompt_tokens: cumulativePromptTokens,
                                completion_tokens: cumulativeCompletionTokens,
                                total_tokens: cumulativePromptTokens + cumulativeCompletionTokens,
                            },
                            model: model,
                        });
                    }
                    res.end();
                    resolve();
                });

                targetRes.on('error', reject);
            });

            targetReq.on('error', reject);
            if (body) targetReq.write(body);
            targetReq.end();
        });
    }

    private async trackTokenUsage(responseData: any): Promise<void> {
        console.log(`[TokenTracker] Proxy trackTokenUsage called with: ${JSON.stringify(responseData)}`);
        
        if (!this.statisticsService) {
            console.log('[TokenTracker] Proxy statisticsService is null, skipping tracking');
            return;
        }
        
        try {
            const usage = this.extractUsageFromResponse(responseData);
            console.log(`[TokenTracker] Proxy extracted usage: ${JSON.stringify(usage)}`);
            
            if (!usage) {
                console.log('[TokenTracker] Proxy no usage data extracted, skipping tracking');
                return;
            }

            const cost = this.pricingService
                ? this.pricingService.calculateCost(usage.promptTokens, usage.completionTokens)
                : 0;

            if (this.storageService) {
                const record = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    timestamp: Date.now(),
                    model: usage.model || 'Unknown Model',
                    promptTokens: usage.promptTokens,
                    completionTokens: usage.completionTokens,
                    totalTokens: usage.totalTokens,
                    cost: cost,
                };
                await this.storageService.addUsageRecord(record);
                console.log('[TokenTracker] Proxy saved usage record');
            } else {
                console.log('[TokenTracker] Proxy storageService is null');
            }

            await this.statisticsService.updateStats(
                usage.promptTokens,
                usage.completionTokens,
                usage.totalTokens,
                cost
            );
            console.log('[TokenTracker] Proxy updated statistics');

            console.log(`[TokenTracker] Proxy tracked: ${usage.totalTokens} tokens (${usage.promptTokens} prompt, ${usage.completionTokens} completion)`);
        } catch (error) {
            console.error('[TokenTracker] Error tracking token usage:', error);
        }
    }
    
    private extractUsageFromResponse(responseData: any): {
        model: string;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    } | null {
        if (!responseData) return null;

        // OpenAI-compatible usage object
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
                    totalTokens,
                };
            }
        }

        // llama.cpp native format
        if (responseData.tokens_evaluated !== undefined && responseData.tokens_predicted !== undefined) {
            return {
                model: responseData.model || 'Unknown Model',
                promptTokens: responseData.tokens_evaluated,
                completionTokens: responseData.tokens_predicted,
                totalTokens: responseData.tokens_evaluated + responseData.tokens_predicted,
            };
        }

        // Direct fields
        if (responseData.prompt_tokens !== undefined && responseData.completion_tokens !== undefined) {
            return {
                model: responseData.model || 'Unknown Model',
                promptTokens: responseData.prompt_tokens,
                completionTokens: responseData.completion_tokens,
                totalTokens: responseData.prompt_tokens + responseData.completion_tokens,
            };
        }
        
        return null;
    }

    private isStreamingRequest(body: string): boolean {
        if (!body) return false;
        try {
            const parsed = JSON.parse(body);
            return parsed.stream === true;
        } catch {
            return false;
        }
    }

    private collectBody(req: http.IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => chunks.push(chunk));
            req.on('end', () => resolve(Buffer.concat(chunks).toString()));
            req.on('error', reject);
        });
    }
}
