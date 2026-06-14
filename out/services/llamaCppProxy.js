"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlamaCppProxy = void 0;
const http = __importStar(require("http"));
const axios_1 = __importDefault(require("axios"));
class LlamaCppProxy {
    constructor(port, targetUrl) {
        this.port = port;
        this.targetUrl = targetUrl;
        this.server = http.createServer(this.handleRequest.bind(this));
    }
    async start() {
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(`Token Tracker Proxy listening on port ${this.port}`);
                resolve();
            });
        });
    }
    stop() {
        this.server.close();
        console.log('Token Tracker Proxy stopped');
    }
    async handleRequest(req, res) {
        // Forward request to llama.cpp server
        try {
            const requestData = await this.collectRequestData(req);
            // Forward request to target server
            const targetResponse = await axios_1.default.post(this.targetUrl, requestData, {
                headers: req.headers,
                timeout: 5000
            });
            // Send response back to client
            res.writeHead(targetResponse.status, targetResponse.headers);
            res.end(targetResponse.data);
        }
        catch (error) {
            console.error('Error in proxy:', error);
            res.writeHead(500);
            res.end('Internal Server Error');
        }
    }
    async collectRequestData(req) {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const parsedData = JSON.parse(body);
                    resolve(parsedData);
                }
                catch (e) {
                    resolve(body);
                }
            });
            req.on('error', reject);
        });
    }
}
exports.LlamaCppProxy = LlamaCppProxy;
//# sourceMappingURL=llamaCppProxy.js.map