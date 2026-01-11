#!/usr/bin/env npx tsx
/**
 * Example 13: ArbitrageService - Production-Ready Complete Workflow
 * 
 * Production-ready arbitrage service with enhanced features:
 * - Structured logging
 * - Configuration validation
 * - Error handling and retry
 * - Trade limits and safety checks
 * - Metrics collection
 * - Graceful shutdown
 *
 * Demonstrates the full arbitrage workflow:
 * 1. Scan markets for opportunities
 * 2. Start real-time monitoring
 * 3. Auto-execute arbitrage
 * 4. Stop and clear positions
 *
 * Environment variables:
 *   POLYMARKET_PRIVATE_KEY - Private key for trading
 *   POLYGON_RPC_URL - RPC URL (optional)
 *   PROFIT_THRESHOLD - Minimum profit % (default: 0.5%)
 *   MIN_TRADE_SIZE - Minimum trade size in USDC (default: 5)
 *   MAX_TRADE_SIZE - Maximum trade size in USDC (default: 100)
 *   DAILY_TRADE_LIMIT - Daily trading limit in USDC (default: 1000)
 *   SCAN_INTERVAL_MS - Scan interval in ms (default: 5000)
 *   LOG_LEVEL - Log level: DEBUG, INFO, WARN, ERROR (default: INFO)
 *   DISABLE_TRADING - Set to 'true' to run in scan-only mode
 * 
 * Usage:
 *   pnpm example:arb-service
 *   npx tsx examples/13-arbitrage-service.ts
 *   npx tsx examples/13-arbitrage-service.ts --scan-only
 *   npx tsx examples/13-arbitrage-service.ts --duration=300
 */

import { config } from 'dotenv';
import path from 'path';
import { ArbitrageService } from '../src/index.js';
import { logger, LogLevel } from './config/logger.js';
import { configValidator, type Config } from './config/validator.js';
import { withRetry } from './config/retry.js';
import { metrics } from './config/metrics.js';
import { TradeLimiter } from './config/trade-limiter.js';

// Load .env from package root
config({ path: path.resolve(process.cwd(), '.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const SCAN_ONLY = args.includes('--scan-only');
const RUN_DURATION = parseInt(
  args.find(a => a.startsWith('--duration='))?.split('=')[1] || '60'
) * 1000;

// Initialize configuration
let appConfig: Config;
let tradeLimiter: TradeLimiter;
let arbService: ArbitrageService | null = null;

async function initialize(): Promise<void> {
  logger.info('Initializing Production Arbitrage Service...');

  try {
    // Validate configuration
    appConfig = configValidator.validateConfig(
      {
        privateKey: process.env.POLYMARKET_PRIVATE_KEY,
        rpcUrl: process.env.POLYGON_RPC_URL,
        profitThreshold: parseFloat(process.env.PROFIT_THRESHOLD || '0.005'),
        minTradeSize: parseFloat(process.env.MIN_TRADE_SIZE || '5'),
        maxTradeSize: parseFloat(process.env.MAX_TRADE_SIZE || '100'),
        scanIntervalMs: parseInt(process.env.SCAN_INTERVAL_MS || '5000'),
        maxMarkets: parseInt(process.env.MAX_MARKETS || '50'),
        enableTrading: !SCAN_ONLY && !!process.env.POLYMARKET_PRIVATE_KEY,
        enableMonitoring: true,
      },
      !SCAN_ONLY // Require private key unless scan-only
    );

    logger.info('Configuration validated', {
      profitThreshold: `${(appConfig.profitThreshold * 100).toFixed(2)}%`,
      minTradeSize: `$${appConfig.minTradeSize}`,
      maxTradeSize: `$${appConfig.maxTradeSize}`,
      dailyLimit: `$${appConfig.dailyTradeLimit}`,
      scanInterval: `${appConfig.scanIntervalMs}ms`,
      enableTrading: appConfig.enableTrading,
    });

    // Initialize trade limiter
    tradeLimiter = new TradeLimiter({
      dailyLimit: appConfig.dailyTradeLimit,
      perTradeLimit: appConfig.maxTradeSize,
      minTradeSize: appConfig.minTradeSize,
      maxTradeSize: appConfig.maxTradeSize,
      minBalance: appConfig.minTradeSize * 2, // Require at least 2x min trade size
    });

    // Initialize ArbitrageService
    arbService = new ArbitrageService({
      privateKey: appConfig.privateKey,
      profitThreshold: appConfig.profitThreshold,
      minTradeSize: appConfig.minTradeSize,
      maxTradeSize: appConfig.maxTradeSize,
      autoExecute: appConfig.enableTrading,
    enableLogging: true,

    // Rebalancer config
      enableRebalancer: appConfig.enableTrading,
    minUsdcRatio: 0.2,
    maxUsdcRatio: 0.8,
    targetUsdcRatio: 0.5,
    imbalanceThreshold: 5,
    rebalanceInterval: 10000,
    rebalanceCooldown: 30000,

    // Execution safety
    sizeSafetyFactor: 0.8,
    autoFixImbalance: true,
  });

    // Set up event listeners with enhanced logging
    setupEventListeners();

    logger.info('ArbitrageService initialized successfully');
    metrics.increment('service_started');

  } catch (error) {
    logger.error('Initialization failed', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

function setupEventListeners(): void {
  if (!arbService) return;

  arbService.on('opportunity', (opp) => {
    logger.info(`Arbitrage opportunity detected: ${opp.type.toUpperCase()}`, {
      profitPercent: `${opp.profitPercent.toFixed(2)}%`,
      recommendedSize: `$${opp.recommendedSize.toFixed(2)}`,
      estimatedProfit: `$${opp.estimatedProfit.toFixed(2)}`,
      description: opp.description,
    });
    metrics.increment('opportunities_detected', { type: opp.type });
  });

  arbService.on('execution', async (result) => {
    if (result.success) {
      logger.info('Trade execution succeeded', {
        type: result.type,
        size: `$${result.size.toFixed(2)}`,
        profit: `$${result.profit.toFixed(2)}`,
        executionTime: `${result.executionTimeMs}ms`,
      });
      metrics.increment('trades_succeeded', { type: result.type });
      metrics.observe('trade_profit', result.profit);
      metrics.observe('trade_execution_time', result.executionTimeMs);
      
      // Record trade in limiter
      if (appConfig.enableTrading) {
        tradeLimiter.recordTrade(result.size);
      }
    } else {
      logger.error('Trade execution failed', new Error(result.error), {
        type: result.type,
        size: `$${result.size.toFixed(2)}`,
      });
      metrics.increment('trades_failed', { type: result.type });
    }
  });

  arbService.on('rebalance', (result) => {
    if (result.success) {
      logger.info('Rebalance executed', {
        action: result.action.type,
        amount: `$${result.action.amount.toFixed(2)}`,
        reason: result.action.reason,
      });
      metrics.increment('rebalances_executed');
    } else {
      logger.warn('Rebalance failed', undefined, new Error(result.error));
      metrics.increment('rebalances_failed');
    }
  });

  arbService.on('balanceUpdate', (balance) => {
    logger.debug('Balance updated', {
      usdc: `$${balance.usdc.toFixed(2)}`,
      yesTokens: balance.yesTokens.toFixed(4),
      noTokens: balance.noTokens.toFixed(4),
    });
    metrics.set('balance_usdc', balance.usdc);
    metrics.set('balance_yes_tokens', balance.yesTokens);
    metrics.set('balance_no_tokens', balance.noTokens);
  });

  arbService.on('error', (error) => {
    logger.error('ArbitrageService error', error);
    metrics.increment('service_errors');
  });
}

async function scanMarkets(): Promise<any[]> {
  if (!arbService) {
    throw new Error('ArbitrageService not initialized');
  }

  logger.info('Scanning markets for arbitrage opportunities...');

  const scanResults = await withRetry(
    () => arbService!.scanMarkets(
      { minVolume24h: 5000, limit: appConfig.maxMarkets },
      0.003 // 0.3% min profit for scanning
    ),
    { maxRetries: 3, initialDelayMs: 2000 },
    'market_scan'
  );

  const opportunities = scanResults.filter(r => r.arbType !== 'none');

  logger.info('Market scan complete', {
    totalMarkets: scanResults.length,
    opportunities: opportunities.length,
  });

  metrics.set('markets_scanned', scanResults.length);
  metrics.set('opportunities_found', opportunities.length);

  if (opportunities.length > 0) {
    logger.info('Top opportunities', {
      opportunities: opportunities.slice(0, 5).map(r => ({
        market: r.market.name.slice(0, 50),
        type: r.arbType,
        profit: `${r.profitPercent.toFixed(2)}%`,
        size: `$${r.availableSize.toFixed(0)}`,
        volume: `$${r.volume24h.toLocaleString()}`,
      })),
    });
  }

  return opportunities;
}

async function startArbitrage(opportunities: any[]): Promise<void> {
  if (!arbService || opportunities.length === 0) {
    return;
  }

  const best = opportunities[0];
  logger.info('Starting arbitrage on best market', {
    market: best.market.name,
    type: best.arbType.toUpperCase(),
    profit: `${best.profitPercent.toFixed(2)}%`,
  });

  await arbService.start(best.market);
  metrics.increment('arbitrage_started');
}

async function cleanup(): Promise<void> {
  logger.info('Cleaning up...');

  if (!arbService) {
    return;
  }

  try {
    await arbService.stop();

    const stats = arbService.getStats();
    logger.info('Session statistics', {
      opportunitiesDetected: stats.opportunitiesDetected,
      executionsAttempted: stats.executionsAttempted,
      executionsSucceeded: stats.executionsSucceeded,
      totalProfit: `$${stats.totalProfit.toFixed(2)}`,
      runningTime: `${(stats.runningTimeMs / 1000).toFixed(0)}s`,
    });

    // Export metrics
    logger.info('Metrics summary', {
      tradesExecuted: metrics.getCounter('trades_executed'),
      tradesSucceeded: metrics.getCounter('trades_succeeded'),
      tradesFailed: metrics.getCounter('trades_failed'),
      opportunitiesDetected: metrics.getCounter('opportunities_detected'),
      dailyTraded: `$${tradeLimiter.getDailyTraded().toFixed(2)}`,
      remainingDailyLimit: `$${tradeLimiter.getRemainingDailyLimit().toFixed(2)}`,
    });

    metrics.increment('service_stopped');
  } catch (error) {
    logger.error('Cleanup error', error instanceof Error ? error : new Error(String(error)));
  }
}

async function main(): Promise<void> {
  // Handle graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await cleanup();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    // Initialize
    await initialize();

    // Step 1: Scan markets
    const opportunities = await scanMarkets();

    if (SCAN_ONLY || opportunities.length === 0) {
      logger.info('Scan-only mode or no opportunities found, exiting');
      await cleanup();
      return;
    }

    // Step 2: Start arbitrage
    await startArbitrage(opportunities);

    // Step 3: Run for duration
    logger.info(`Running for ${RUN_DURATION / 1000} seconds...`);
    logger.info('Press Ctrl+C to stop early');

    await new Promise(resolve => setTimeout(resolve, RUN_DURATION));

    // Step 4: Cleanup
    await cleanup();

  } catch (error) {
    logger.error('Fatal error', error instanceof Error ? error : new Error(String(error)));
    await cleanup();
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('Unhandled error', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});
