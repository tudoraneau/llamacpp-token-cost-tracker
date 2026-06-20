# llama.cpp Token Cost Tracker

Provide token usage and estimated costs for llama.cpp deployments. Also useful for estimating savings when using local LLMs :)
The extension acts as a HTTP proxy to intercept activity from other extensions that interact with llama.cpp such as RooCode, Continue, etc.

# Disclaimer

Use at your own risk, no warranties provided, express or implied.
This extension is not affiliated in any way with any other projects.

## Price Calculation Logic

```typescript
inputPricePerToken = inputCostPerMillion / 1,000,000
outputPricePerToken = outputCostPerMillion / 1,000,000
inputCost = promptTokens * inputPricePerToken
outputCost = completionTokens * outputPricePerToken
totalCost = inputCost + outputCost
```

## Requirements

- VS Code 1.85.0 or higher
- llama.cpp server running

## Setup

1. Configure the llama.cpp server URL under llama.cpp Configuration (default: http://localhost:8080). The hostname/IP address must match the machine where llama.cpp is running.
2. Ensure the proxy port is available on the local machine where this extension is running (default: 8081)
3. Configure the proxy port to 8081 under Proxy Settings
4. Configure the proxy target URL to the server URL running the llama.cpp server (http://localhost:8080). The hostname/IP address must match the machine where llama.cpp is running
5. Configure cost settings
6. Point your other extension (i.e.: RooCode, Continue) to the URL where the proxy is running (http://localhost:8081/v1)


## Settings

- `tokenTracker.currency`: Currency for cost calculations (default: USD)
- `tokenTracker.decimalPlaces`: Decimal places for cost calculations (default: 4)
- `tokenTracker.maxHistoryEntries`: Maximum number of history entries (default: 100000)
- `tokenTracker.showStatusBar`: Show status bar item (default: true)
- `tokenTracker.confirmBeforeDelete`: Confirm before deleting data (default: true)
- `tokenTracker.storageScope`: Storage scope for data (default: global)
- `tokenTracker.proxy.enabled`: Enable proxy mode for token tracking (default: true)
- `tokenTracker.proxy.port`: Port for proxy service (default: 8081)
- `tokenTracker.proxy.targetUrl`: Target URL of llama.cpp server (default: http://localhost:8080)
- `tokenTracker.llamaCpp.serverUrl`: URL of llama.cpp server (default: http://localhost:8080)
- `tokenTracker.llamaCpp.requestTimeoutMs`: Request timeout in milliseconds (default: 5000)
- `tokenTracker.llamaCpp.enableLogMonitoring`: Enable log monitoring for token tracking (default: false)
- `tokenTracker.llamaCpp.logPath`: Path to log file for monitoring

## Commands

- `Token Tracker: Open Dashboard`
- `Token Tracker: Export JSON`
- `Token Tracker: Export CSV`
- `Token Tracker: Import JSON`
- `Token Tracker: Import CSV`
- `Token Tracker: Reset Session`
- `Token Tracker: Clear History`
- `Token Tracker: Backup Database`
- `Token Tracker: Restore Database`
- `Token Tracker: Select Log File`
- `Token Tracker: Stop Log Monitoring`

## License

MIT