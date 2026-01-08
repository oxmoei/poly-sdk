# Production Examples

This directory contains production-ready versions of the examples with enhanced features for real-world deployment.

## Features

All production examples include:

- ✅ **Structured Logging** - JSON logs with log levels
- ✅ **Configuration Validation** - Startup validation of all required config
- ✅ **Error Handling** - Retry mechanisms with exponential backoff
- ✅ **Trade Limits** - Daily and per-trade limits with safety checks
- ✅ **Metrics Collection** - Built-in metrics for monitoring
- ✅ **Graceful Shutdown** - Proper cleanup on shutdown signals
- ✅ **Sensitive Data Masking** - Automatic masking of private keys and secrets

## Examples

### arbitrage-service.ts

Production-ready arbitrage service with full trading capabilities.

**Features:**
- Market scanning with configurable criteria
- Real-time arbitrage detection
- Auto-execution with safety limits
- Position rebalancing
- Trade limit enforcement

**Usage:**
```bash
# Set required environment variables
export POLYMARKET_PRIVATE_KEY=0x...
export PROFIT_THRESHOLD=0.005
export MIN_TRADE_SIZE=5
export MAX_TRADE_SIZE=100
export DAILY_TRADE_LIMIT=1000

# Run
npx tsx examples/production/arbitrage-service.ts

# Scan-only mode (no trading)
npx tsx examples/production/arbitrage-service.ts --scan-only

# Custom duration
npx tsx examples/production/arbitrage-service.ts --duration=300
```

### arbitrage-monitor.ts

Production-ready arbitrage monitoring service (read-only).

**Features:**
- Continuous market monitoring
- Opportunity detection
- Result persistence
- Configurable scan intervals

**Usage:**
```bash
# Set environment variables
export SCAN_INTERVAL_MS=5000
export MIN_PROFIT_THRESHOLD=0.1
export MAX_MARKETS=20
export RESULTS_FILE=./results.json

# Run
npx tsx examples/production/arbitrage-monitor.ts

# Limited cycles
npx tsx examples/production/arbitrage-monitor.ts --max-cycles=100
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `POLYMARKET_PRIVATE_KEY` | Private key for trading | - | Yes (for trading) |
| `POLYGON_RPC_URL` | RPC URL | `https://polygon-rpc.com` | No |
| `PROFIT_THRESHOLD` | Minimum profit % | `0.005` (0.5%) | No |
| `MIN_TRADE_SIZE` | Minimum trade size (USDC) | `5` | No |
| `MAX_TRADE_SIZE` | Maximum trade size (USDC) | `100` | No |
| `DAILY_TRADE_LIMIT` | Daily trading limit (USDC) | `1000` | No |
| `SCAN_INTERVAL_MS` | Scan interval (ms) | `5000` | No |
| `MAX_MARKETS` | Max markets to monitor | `20` | No |
| `LOG_LEVEL` | Log level (DEBUG/INFO/WARN/ERROR) | `INFO` | No |
| `LOG_FILE` | Log file path | - | No |
| `DISABLE_TRADING` | Disable trading (scan-only) | `false` | No |

### Command Line Arguments

- `--scan-only` - Run in scan-only mode (no trading)
- `--duration=<seconds>` - Run for specified duration
- `--max-cycles=<number>` - Maximum scan cycles (monitor only)

## Shared Modules

### config/logger.ts

Structured logging with:
- JSON output format
- Log levels (DEBUG, INFO, WARN, ERROR)
- Sensitive data masking
- File logging support

### config/validator.ts

Configuration validation:
- Environment variable validation
- Private key format checking
- Trade limit validation
- RPC URL validation

### config/retry.ts

Retry mechanism with:
- Exponential backoff
- Configurable retry attempts
- Retryable error detection

### config/metrics.ts

Metrics collection:
- Counters
- Gauges
- Histograms
- Export for monitoring systems

### config/trade-limiter.ts

Trade limit enforcement:
- Daily limits
- Per-trade limits
- Balance checks
- Trade recording

## Monitoring

### Metrics

All production examples expose metrics:

- `service_started` - Service start counter
- `service_stopped` - Service stop counter
- `opportunities_detected` - Opportunities found
- `trades_executed` - Trades executed
- `trades_succeeded` - Successful trades
- `trades_failed` - Failed trades
- `trade_profit` - Trade profit histogram
- `balance_usdc` - Current USDC balance
- `scan_errors` - Scan error counter

### Logs

Structured JSON logs include:
- Timestamp
- Log level
- Message
- Context data
- Error details (if applicable)

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npx", "tsx", "examples/production/arbitrage-service.ts"]
```

### Systemd Service

```ini
[Unit]
Description=Poly-SDK Arbitrage Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/poly-sdk
Environment="POLYMARKET_PRIVATE_KEY=0x..."
Environment="PROFIT_THRESHOLD=0.005"
ExecStart=/usr/bin/npx tsx examples/production/arbitrage-service.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Differences from Examples

| Feature | Examples | Production |
|---------|----------|------------|
| Logging | console.log | Structured JSON logs |
| Error Handling | Basic try-catch | Retry with backoff |
| Configuration | Environment vars | Validated config |
| Trade Limits | None | Enforced limits |
| Metrics | None | Built-in metrics |
| Shutdown | Basic | Graceful cleanup |
| Data Masking | None | Automatic masking |

## Best Practices

1. **Start with scan-only mode** to verify configuration
2. **Set conservative limits** initially
3. **Monitor logs** for errors and opportunities
4. **Use metrics** to track performance
5. **Set up alerts** for critical errors
6. **Test with small amounts** before scaling up

## Support

For issues or questions:
- Check [PRODUCTION_READINESS.md](../PRODUCTION_READINESS.md) for detailed analysis
- Review [使用指南.md](../../使用指南.md) for general usage
- See [scripts/README.md](../../scripts/README.md) for alternative production scripts

