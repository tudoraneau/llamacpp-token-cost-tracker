# Token Cost Tracker for VS Code

Track token usage and estimated costs for local llama.cpp deployments directly within Visual Studio Code.

## Features

- Automatic token tracking from llama.cpp server
- Real-time dashboard with usage statistics
- Cost calculation based on model pricing
- Support for multiple model profiles
- Export/import functionality
- Log monitoring for token usage
- Proxy mode for accurate tracking

## Requirements

- VS Code 1.85.0 or higher
- Local llama.cpp server running

## Setup

1. Install the extension from the VS Code Marketplace
2. Configure the llama.cpp server URL in settings (default: http://localhost:8080)
3. If using proxy mode, ensure the proxy port is available (default: 31000)
4. Configure model profiles with pricing information

## Usage

- Click the Token Tracker icon in the Activity Bar to open the dashboard
- Click the status bar item to open the dashboard
- Use the commands in the Command Palette to manage data

## Settings

- `tokenTracker.currency`: Currency for cost calculations (default: USD)
- `tokenTracker.decimalPlaces`: Decimal places for cost calculations (default: 4)
- `tokenTracker.maxHistoryEntries`: Maximum number of history entries (default: 100000)
- `tokenTracker.showStatusBar`: Show status bar item (default: true)
- `tokenTracker.enableCharts`: Enable charts in dashboard (default: true)
- `tokenTracker.confirmBeforeDelete`: Confirm before deleting data (default: true)
- `tokenTracker.storageScope`: Storage scope for data (default: global)
- `tokenTracker.proxy.enabled`: Enable proxy mode for token tracking (default: true)
- `tokenTracker.proxy.port`: Port for proxy service (default: 31000)
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
- `Token Tracker: Manage Models`
- `Token Tracker: Backup Database`
- `Token Tracker: Restore Database`
- `Token Tracker: Select Log File`
- `Token Tracker: Stop Log Monitoring`

## Extension Settings

This extension contributes the following settings:

* `tokenTracker.currency`: Currency for cost calculations
* `tokenTracker.decimalPlaces`: Decimal places for cost calculations
* `tokenTracker.maxHistoryEntries`: Maximum number of history entries to store
* `tokenTracker.showStatusBar`: Show status bar item
* `tokenTracker.enableCharts`: Enable charts in dashboard
* `tokenTracker.confirmBeforeDelete`: Confirm before deleting data
* `tokenTracker.storageScope`: Storage scope for data
* `tokenTracker.proxy.enabled`: Enable proxy mode for token tracking
* `tokenTracker.proxy.port`: Port for proxy service
* `tokenTracker.proxy.targetUrl`: Target URL of llama.cpp server
* `tokenTracker.llamaCpp.serverUrl`: URL of llama.cpp server
* `tokenTracker.llamaCpp.requestTimeoutMs`: Request timeout in milliseconds
* `tokenTracker.llamaCpp.enableLogMonitoring`: Enable log monitoring for token tracking
* `tokenTracker.llamaCpp.logPath`: Path to log file for monitoring

## Release Notes

### 0.0.1

- Initial release

## License

MIT