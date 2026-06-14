import * as http from 'http';
import * as vscode from 'vscode';
import axios from 'axios';
export class LlamaCppProxy {
    private server: http.Server;
    private port: number;
    private targetUrl: string;
    constructor(port: number, targetUrl: string) {
        this.port = port;
        this.targetUrl = targetUrl;
        this.server = http.createServer(this.handleRequest.bind(this));
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
                timeout: 5000
            });
            
            // Send response back to client
            res.writeHead(targetResponse.status, targetResponse.headers);
            res.end(targetResponse.data);
        } catch (error) {
            console.error('Error in proxy:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
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
