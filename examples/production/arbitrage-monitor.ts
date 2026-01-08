#!/usr/bin/env npx tsx
/**
 * Production Arbitrage Monitor
 * 
 * Enhanced version of example 12 with production-ready features:
 * - Structured logging
 * - Configuration validation
 * - Error handling and retry
 * - Metrics collection
 * - Result persistence
 * - Graceful shutdown
 * 
 * Environment variables:
 *   SCAN_INTERVAL_MS - Scan interval in ms (default: 5000)
 *   MIN_PROFIT_THRESHOLD - Minimum profit % (default: 0.1%)
 *   MAX_MARKETS - Max markets to monitor (default: 20)
 *   MAX_CYCLES - Max scan cycles (0 = unlimited, default: 0)
 *   LOG_LEVEL - Log level: DEBUG, INFO, WARN, ERROR (default: INFO)
 *   RESULTS_FILE - File to save results (optional)
 * 
 * Usage:
 *   npx tsx examples/production/arbitrage-monitor.ts
 *   npx tsx examples/production/arbitrage-monitor.ts --max-cycles=100
 */

import { PolymarketSDK, checkArbitrage, getEffectivePrices } from '../../src/index.js';
import { logger } from './config/logger.js';
import { configValidator } from './config/validator.js';
import { withRetry } from './config/retry.js';
import { metrics } from './config/metrics.js';

// Configuration
interface MonitorConfig {
  scanIntervalMs: number;
  minProfitThreshold: number;
  maxMarkets: number;
  maxCycles: number;
  refreshMarketsIntervalMs: number;
  resultsFile?: string;
}

const CONFIG: MonitorConfig = {
  scanIntervalMs: parseInt(process.env.SCAN_INTERVAL_MS || '5000'),
  minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '0.1') / 100,
  maxMarkets: parseInt(process.env.MAX_MARKETS || '20'),
  maxCycles: parseInt(process.env.MAX_CYCLES || '0'),
  refreshMarketsIntervalMs: 60000,
  resultsFile: process.env.RESULTS_FILE,
};

// Types
interface MonitoredMarket {
  conditionId: string;
  question: string;
  slug: string;
  volume24h: number;
  lastUpdate: number;
  lastEffectiveLongCost?: number;
  lastEffectiveShortRevenue?: number;
  scanCount: number;
  errorCount: number;
}

interface ScanResult {
  timestamp: number;
  market: MonitoredMarket;
  yesAsk: number;
  noAsk: number;
  yesBid: number;
  noBid: number;
  effectiveBuyYes: number;
  effectiveBuyNo: number;
  effectiveSellYes: number;
  effectiveSellNo: number;
  effectiveLongCost: number;
  effectiveShortRevenue: number;
  longArbProfit: number;
  shortArbProfit: number;
  yesSpread: number;
  hasOpportunity: boolean;
  opportunityType?: 'long' | 'short';
}

// State
let markets: MonitoredMarket[] = [];
let scanCount = 0;
let opportunitiesFound = 0;
let totalScans = 0;
let lastMarketRefresh = 0;
let allResults: ScanResult[] = [];

async function fetchTrendingMarkets(sdk: PolymarketSDK): Promise<MonitoredMarket[]> {
  logger.info(`Fetching top ${CONFIG.maxMarkets} trending markets...`);

  try {
    const trendingMarkets = await withRetry(
      () => sdk.gammaApi.getTrendingMarkets(CONFIG.maxMarkets),
      { maxRetries: 3, initialDelayMs: 2000 },
      'fetch_trending_markets'
    );

    const monitored: MonitoredMarket[] = trendingMarkets
      .filter(m => m.conditionId)
      .map(m => ({
        conditionId: m.conditionId,
        question: m.question || 'Unknown',
        slug: m.slug || '',
        volume24h: m.volume24hr || 0,
        lastUpdate: Date.now(),
        scanCount: 0,
        errorCount: 0,
      }));

    logger.info(`Loaded ${monitored.length} trending markets`);
    metrics.set('markets_monitored', monitored.length);

    return monitored;
  } catch (error) {
    logger.error('Failed to fetch trending markets', error instanceof Error ? error : new Error(String(error)));
    metrics.increment('market_fetch_errors');
    return [];
  }
}

async function scanMarket(sdk: PolymarketSDK, market: MonitoredMarket): Promise<ScanResult | null> {
  try {
    const orderbook = await withRetry(
      () => sdk.markets.getProcessedOrderbook(market.conditionId),
      { maxRetries: 2, initialDelayMs: 1000 },
      `scan_market_${market.conditionId.slice(0, 10)}`
    );

    market.scanCount++;
    market.lastUpdate = Date.now();
    market.lastEffectiveLongCost = orderbook.summary.effectiveLongCost;
    market.lastEffectiveShortRevenue = orderbook.summary.effectiveShortRevenue;

    const { effectivePrices } = orderbook.summary;

    const arb = checkArbitrage(
      orderbook.yes.ask,
      orderbook.no.ask,
      orderbook.yes.bid,
      orderbook.no.bid
    );

    const hasOpportunity = arb !== null && arb.profit > CONFIG.minProfitThreshold;

    const result: ScanResult = {
      timestamp: Date.now(),
      market,
      yesAsk: orderbook.yes.ask,
      noAsk: orderbook.no.ask,
      yesBid: orderbook.yes.bid,
      noBid: orderbook.no.bid,
      effectiveBuyYes: effectivePrices.effectiveBuyYes,
      effectiveBuyNo: effectivePrices.effectiveBuyNo,
      effectiveSellYes: effectivePrices.effectiveSellYes,
      effectiveSellNo: effectivePrices.effectiveSellNo,
      effectiveLongCost: orderbook.summary.effectiveLongCost,
      effectiveShortRevenue: orderbook.summary.effectiveShortRevenue,
      longArbProfit: orderbook.summary.longArbProfit,
      shortArbProfit: orderbook.summary.shortArbProfit,
      yesSpread: orderbook.summary.yesSpread,
      hasOpportunity,
      opportunityType: arb?.type,
    };

    return result;
  } catch (error) {
    market.errorCount++;
    logger.warn(
      `Scan failed for ${market.question.slice(0, 30)}...`,
      undefined,
      error instanceof Error ? error : new Error(String(error))
    );
    metrics.increment('scan_errors');
    return null;
  }
}

async function runScanCycle(sdk: PolymarketSDK): Promise<void> {
  scanCount++;
  const cycleStart = Date.now();

  logger.info(`Scan cycle #${scanCount}`, {
    markets: markets.length,
  });

  const results: ScanResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (const market of markets) {
    const result = await scanMarket(sdk, market);
    totalScans++;

    if (result) {
      successCount++;
      results.push(result);
      allResults.push(result);

      if (result.hasOpportunity) {
        logger.info(`Arbitrage opportunity: ${result.opportunityType?.toUpperCase()}`, {
          market: result.market.question,
          conditionId: result.market.conditionId,
          profit: `${(Math.max(result.longArbProfit, result.shortArbProfit) * 100).toFixed(3)}%`,
          effectiveLongCost: result.effectiveLongCost.toFixed(4),
          effectiveShortRevenue: result.effectiveShortRevenue.toFixed(4),
        });
      }
    } else {
      errorCount++;
    }
  }

  const opportunities = results.filter(r => r.hasOpportunity);
  if (opportunities.length > 0) {
    opportunitiesFound += opportunities.length;
    metrics.increment('opportunities_detected', { count: opportunities.length.toString() });
  }

  const cycleTime = Date.now() - cycleStart;
  logger.info(`Cycle #${scanCount} complete`, {
    duration: `${cycleTime}ms`,
    scanned: successCount,
    errors: errorCount,
    opportunities: opportunities.length,
  });

  metrics.set('scan_cycle_duration_ms', cycleTime);
  metrics.set('scan_success_rate', successCount / markets.length);
}

async function maybeRefreshMarkets(sdk: PolymarketSDK): Promise<void> {
  const now = Date.now();
  if (now - lastMarketRefresh > CONFIG.refreshMarketsIntervalMs) {
    logger.info('Refreshing trending markets list...');
    const newMarkets = await fetchTrendingMarkets(sdk);
    if (newMarkets.length > 0) {
      markets = newMarkets;
      lastMarketRefresh = now;
      metrics.increment('market_refreshes');
    }
  }
}

function saveResults(): void {
  if (!CONFIG.resultsFile) return;

  try {
    // In production, save to file or database
    // For now, just log the summary
    logger.info('Results summary', {
      totalScans: allResults.length,
      opportunities: allResults.filter(r => r.hasOpportunity).length,
      topOpportunities: allResults
        .filter(r => r.hasOpportunity)
        .sort((a, b) => {
          const profitA = Math.max(a.longArbProfit, a.shortArbProfit);
          const profitB = Math.max(b.longArbProfit, b.shortArbProfit);
          return profitB - profitA;
        })
        .slice(0, 10)
        .map(r => ({
          market: r.market.question,
          type: r.opportunityType,
          profit: `${(Math.max(r.longArbProfit, r.shortArbProfit) * 100).toFixed(2)}%`,
        })),
    });
  } catch (error) {
    logger.error('Failed to save results', error instanceof Error ? error : new Error(String(error)));
  }
}

async function main(): Promise<void> {
  logger.info('Starting Production Arbitrage Monitor', {
    config: {
      scanInterval: `${CONFIG.scanIntervalMs}ms`,
      minProfitThreshold: `${CONFIG.minProfitThreshold * 100}%`,
      maxMarkets: CONFIG.maxMarkets,
      maxCycles: CONFIG.maxCycles || 'unlimited',
    },
  });

  // Validate config
  try {
    configValidator.validateConfig({}, false);
  } catch (error) {
    logger.error('Configuration validation failed', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }

  // Initialize SDK
  const sdk = new PolymarketSDK();

  // Fetch initial markets
  markets = await fetchTrendingMarkets(sdk);
  lastMarketRefresh = Date.now();

  if (markets.length === 0) {
    logger.error('No markets to monitor. Exiting.');
    process.exit(1);
  }

  // Handle graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully...`);
    
    saveResults();
    
    logger.info('Final statistics', {
      totalCycles: scanCount,
      totalScans,
      opportunitiesFound,
      runtime: `${Math.round((Date.now() - lastMarketRefresh) / 1000)}s`,
    });

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Monitor loop
  const runLoop = async () => {
    try {
      await maybeRefreshMarkets(sdk);
      await runScanCycle(sdk);
    } catch (error) {
      logger.error('Scan cycle error', error instanceof Error ? error : new Error(String(error)));
      metrics.increment('cycle_errors');
    }

    // Check if we've reached max cycles
    if (CONFIG.maxCycles > 0 && scanCount >= CONFIG.maxCycles) {
      logger.info('Max cycles reached');
      await shutdown('max_cycles');
      return;
    }

    // Schedule next scan
    setTimeout(runLoop, CONFIG.scanIntervalMs);
  };

  // Start loop
  await runLoop();
}

main().catch(error => {
  logger.error('Fatal error', error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
});

