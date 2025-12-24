/**
 * @catalyst-team/poly-sdk
 *
 * Unified SDK for Polymarket APIs
 * - Data API (positions, activity, trades, leaderboard)
 * - Gamma API (markets, events, trending)
 * - CLOB API (orderbook, market info, trading)
 * - Services (WalletService, MarketService)
 */

// Core infrastructure
export { RateLimiter, ApiType } from './core/rate-limiter.js';
export { Cache, CACHE_TTL } from './core/cache.js';
export { PolymarketError, ErrorCode, withRetry } from './core/errors.js';
export * from './core/types.js';

// Cache integration (new)
export type { UnifiedCache } from './core/unified-cache.js';
export { createUnifiedCache } from './core/unified-cache.js';

// API Clients
export { DataApiClient } from './clients/data-api.js';
export type {
  Position,
  Activity,
  Trade,
  LeaderboardEntry,
  LeaderboardPage,
} from './clients/data-api.js';

export { GammaApiClient } from './clients/gamma-api.js';
export type {
  GammaMarket,
  GammaEvent,
  MarketSearchParams,
} from './clients/gamma-api.js';

export { ClobApiClient } from './clients/clob-api.js';
export type {
  ClobMarket,
  ClobToken,
  Orderbook,
  OrderbookLevel,
} from './clients/clob-api.js';

// Services
export { WalletService } from './services/wallet-service.js';
export type {
  WalletProfile,
  WalletActivitySummary,
  SellActivityResult,
} from './services/wallet-service.js';

export { MarketService, getIntervalMs as getIntervalMsService } from './services/market-service.js';

// Real-time
export { WebSocketManager } from './clients/websocket-manager.js';
export type { WebSocketManagerConfig, WebSocketManagerEvents } from './clients/websocket-manager.js';

export { RealtimeService } from './services/realtime-service.js';
export type { Subscription, MarketSubscriptionHandlers } from './services/realtime-service.js';

// ArbitrageService (Real-time arbitrage detection, execution, rebalancing, and settlement)
export { ArbitrageService } from './services/arbitrage-service.js';
export type {
  ArbitrageMarketConfig,
  ArbitrageServiceConfig,
  ArbitrageOpportunity as ArbitrageServiceOpportunity,
  ArbitrageExecutionResult,
  ArbitrageServiceEvents,
  OrderbookState,
  BalanceState,
  // Rebalancer types
  RebalanceAction,
  RebalanceResult,
  // Settle types
  SettleResult,
  // Clear position types (smart settle)
  ClearPositionResult,
  ClearAction,
  // Scanning types
  ScanCriteria,
  ScanResult,
} from './services/arbitrage-service.js';

// Trading
export { TradingClient, POLYGON_MAINNET, POLYGON_AMOY } from './clients/trading-client.js';
export type {
  Side,
  OrderType,
  ApiCredentials,
  OrderParams,
  MarketOrderParams,
  Order,
  OrderResult,
  TradeInfo,
  TradingClientConfig,
  // Rewards types
  UserEarning,
  MarketReward,
  OrderScoring,
} from './clients/trading-client.js';

// CTF (Conditional Token Framework)
// NOTE: USDC_CONTRACT is USDC.e (bridged), required for Polymarket CTF
// NATIVE_USDC_CONTRACT is native USDC, NOT compatible with CTF
export {
  CTFClient,
  CTF_CONTRACT,
  USDC_CONTRACT,           // USDC.e (0x2791...) - Required for CTF
  NATIVE_USDC_CONTRACT,    // Native USDC (0x3c49...) - NOT for CTF
  NEG_RISK_CTF_EXCHANGE,
  NEG_RISK_ADAPTER,
  USDC_DECIMALS,
  calculateConditionId,
  parseUsdc,
  formatUsdc,
} from './clients/ctf-client.js';
export type {
  CTFConfig,
  SplitResult,
  MergeResult,
  RedeemResult,
  PositionBalance,
  MarketResolution,
  GasEstimate,
  TransactionStatus,
  TokenIds,
} from './clients/ctf-client.js';
export { RevertReason } from './clients/ctf-client.js';

// Bridge (Cross-chain Deposits)
export {
  BridgeClient,
  SUPPORTED_CHAINS,
  BRIDGE_TOKENS,
  estimateBridgeOutput,
  getExplorerUrl,
  depositUsdc,
  swapAndDeposit,
  getSupportedDepositTokens,
} from './clients/bridge-client.js';
export type {
  BridgeSupportedAsset,
  DepositAddress,
  CreateDepositResponse,
  DepositStatus,
  BridgeConfig,
  DepositResult,
  DepositOptions,
  SwapAndDepositOptions,
  SwapAndDepositResult,
} from './clients/bridge-client.js';

// Swap Service (DEX swaps on Polygon)
export {
  SwapService,
  QUICKSWAP_ROUTER,
  POLYGON_TOKENS,
  TOKEN_DECIMALS,
} from './services/swap-service.js';
export type {
  SupportedToken,
  SwapQuote,
  SwapResult,
  TokenBalance,
  TransferResult,
} from './services/swap-service.js';

// Authorization (ERC20/ERC1155 Approvals)
export { AuthorizationService } from './services/authorization-service.js';
export type {
  AllowanceInfo,
  AllowancesResult,
  ApprovalTxResult,
  ApprovalsResult,
  AuthorizationServiceConfig,
} from './services/authorization-service.js';

// Price Utilities
export {
  roundPrice,
  roundSize,
  validatePrice,
  validateSize,
  calculateBuyAmount,
  calculateSellPayout,
  calculateSharesForAmount,
  calculateSpread,
  calculateMidpoint,
  formatPrice,
  formatUSDC,
  calculatePnL,
  checkArbitrage,
  getEffectivePrices,
  ROUNDING_CONFIG,
} from './utils/price-utils.js';
export type { TickSize } from './utils/price-utils.js';

// NOTE: MCP tools have been moved to @catalyst-team/poly-mcp package
// See packages/poly-mcp/

// ===== Main SDK Class =====

import { RateLimiter } from './core/rate-limiter.js';
import { DataApiClient } from './clients/data-api.js';
import { GammaApiClient } from './clients/gamma-api.js';
import { ClobApiClient } from './clients/clob-api.js';
import { WalletService } from './services/wallet-service.js';
import { MarketService } from './services/market-service.js';
import type { UnifiedMarket, ProcessedOrderbook, ArbitrageOpportunity, KLineInterval, KLineCandle, DualKLineData, PolySDKOptions } from './core/types.js';
import { PolymarketError, ErrorCode } from './core/errors.js';
import { createUnifiedCache, type UnifiedCache } from './core/unified-cache.js';

// Re-export for backward compatibility
export interface PolymarketSDKConfig extends PolySDKOptions {}

export class PolymarketSDK {
  // Infrastructure
  private rateLimiter: RateLimiter;
  private cache: UnifiedCache;

  // API Clients
  public readonly dataApi: DataApiClient;
  public readonly gammaApi: GammaApiClient;
  public readonly clobApi: ClobApiClient;

  // Services
  public readonly wallets: WalletService;
  public readonly markets: MarketService;

  constructor(config: PolymarketSDKConfig = {}) {
    // Initialize infrastructure
    this.rateLimiter = new RateLimiter();

    // Create unified cache (supports both legacy Cache and CacheAdapter)
    this.cache = createUnifiedCache(config.cache);

    // Initialize API clients
    this.dataApi = new DataApiClient(this.rateLimiter, this.cache);
    this.gammaApi = new GammaApiClient(this.rateLimiter, this.cache);
    this.clobApi = new ClobApiClient(this.rateLimiter, this.cache, {
      chainId: config.chainId,
      signer: config.signer,
      creds: config.creds,
    });

    // Initialize services
    this.wallets = new WalletService(this.dataApi, this.cache);
    this.markets = new MarketService(this.gammaApi, this.clobApi, this.dataApi, this.cache);
  }

  // ===== Unified Market Access =====

  /**
   * Get market by slug or condition ID
   * Uses Gamma for slug, CLOB for conditionId
   */
  async getMarket(identifier: string): Promise<UnifiedMarket> {
    const isConditionId =
      identifier.startsWith('0x') || /^\d+$/.test(identifier);

    if (isConditionId) {
      return this.getMarketByConditionId(identifier);
    } else {
      return this.getMarketBySlug(identifier);
    }
  }

  private async getMarketBySlug(slug: string): Promise<UnifiedMarket> {
    // Gamma as primary source for slug
    const gammaMarket = await this.gammaApi.getMarketBySlug(slug);
    if (!gammaMarket) {
      throw new PolymarketError(
        ErrorCode.MARKET_NOT_FOUND,
        `Market not found: ${slug}`
      );
    }

    // Enrich with CLOB data
    try {
      const clobMarket = await this.clobApi.getMarket(gammaMarket.conditionId);
      return this.mergeMarkets(gammaMarket, clobMarket);
    } catch {
      return this.fromGammaMarket(gammaMarket);
    }
  }

  private async getMarketByConditionId(
    conditionId: string
  ): Promise<UnifiedMarket> {
    // CLOB as primary source for conditionId (more reliable)
    try {
      const clobMarket = await this.clobApi.getMarket(conditionId);

      // Try to enrich with Gamma data
      try {
        const gammaMarket =
          await this.gammaApi.getMarketByConditionId(conditionId);
        if (gammaMarket) {
          return this.mergeMarkets(gammaMarket, clobMarket);
        }
      } catch {
        // Gamma enrichment failed, use CLOB only
      }

      return this.fromClobMarket(clobMarket);
    } catch {
      throw new PolymarketError(
        ErrorCode.MARKET_NOT_FOUND,
        `Market not found: ${conditionId}`
      );
    }
  }

  // ===== Orderbook Analysis =====

  /**
   * Get processed orderbook with analytics
   */
  async getOrderbook(conditionId: string): Promise<ProcessedOrderbook> {
    return this.clobApi.getProcessedOrderbook(conditionId);
  }

  /**
   * Detect arbitrage opportunity
   *
   * 使用有效价格计算套利机会（正确考虑镜像订单）
   * 详细文档见: docs/01-polymarket-orderbook-arbitrage.md
   */
  async detectArbitrage(
    conditionId: string,
    threshold = 0.005
  ): Promise<ArbitrageOpportunity | null> {
    const orderbook = await this.getOrderbook(conditionId);
    const { effectivePrices, longArbProfit, shortArbProfit } = orderbook.summary;

    if (longArbProfit > threshold) {
      return {
        type: 'long',
        profit: longArbProfit,
        action: `Buy YES @ ${effectivePrices.effectiveBuyYes.toFixed(4)} + Buy NO @ ${effectivePrices.effectiveBuyNo.toFixed(4)}, merge for 1 USDC`,
        expectedProfit: longArbProfit,
      };
    }

    if (shortArbProfit > threshold) {
      return {
        type: 'short',
        profit: shortArbProfit,
        action: `Split 1 USDC, Sell YES @ ${effectivePrices.effectiveSellYes.toFixed(4)} + Sell NO @ ${effectivePrices.effectiveSellNo.toFixed(4)}`,
        expectedProfit: shortArbProfit,
      };
    }

    return null;
  }

  // ===== Helper Methods =====

  private mergeMarkets(
    gamma: import('./clients/gamma-api.js').GammaMarket,
    clob: import('./clients/clob-api.js').ClobMarket
  ): UnifiedMarket {
    const yesToken = clob.tokens.find((t) => t.outcome === 'Yes');
    const noToken = clob.tokens.find((t) => t.outcome === 'No');

    return {
      conditionId: clob.conditionId,
      slug: gamma.slug,
      question: clob.question,
      description: clob.description || gamma.description,
      tokens: {
        yes: {
          tokenId: yesToken?.tokenId || '',
          price: yesToken?.price || gamma.outcomePrices[0] || 0.5,
        },
        no: {
          tokenId: noToken?.tokenId || '',
          price: noToken?.price || gamma.outcomePrices[1] || 0.5,
        },
      },
      volume: gamma.volume,
      volume24hr: gamma.volume24hr,
      liquidity: gamma.liquidity,
      spread: gamma.spread,
      active: clob.active,
      closed: clob.closed,
      acceptingOrders: clob.acceptingOrders,
      endDate: clob.endDateIso ? new Date(clob.endDateIso) : new Date(),
      source: 'merged',
    };
  }

  private fromGammaMarket(
    gamma: import('./clients/gamma-api.js').GammaMarket
  ): UnifiedMarket {
    return {
      conditionId: gamma.conditionId,
      slug: gamma.slug,
      question: gamma.question,
      description: gamma.description,
      tokens: {
        yes: { tokenId: '', price: gamma.outcomePrices[0] || 0.5 },
        no: { tokenId: '', price: gamma.outcomePrices[1] || 0.5 },
      },
      volume: gamma.volume,
      volume24hr: gamma.volume24hr,
      liquidity: gamma.liquidity,
      spread: gamma.spread,
      active: gamma.active,
      closed: gamma.closed,
      acceptingOrders: !gamma.closed,
      endDate: gamma.endDate,
      source: 'gamma',
    };
  }

  private fromClobMarket(
    clob: import('./clients/clob-api.js').ClobMarket
  ): UnifiedMarket {
    const yesToken = clob.tokens.find((t) => t.outcome === 'Yes');
    const noToken = clob.tokens.find((t) => t.outcome === 'No');

    return {
      conditionId: clob.conditionId,
      slug: clob.marketSlug,
      question: clob.question,
      description: clob.description,
      tokens: {
        yes: { tokenId: yesToken?.tokenId || '', price: yesToken?.price || 0.5 },
        no: { tokenId: noToken?.tokenId || '', price: noToken?.price || 0.5 },
      },
      volume: 0, // CLOB doesn't have volume
      volume24hr: undefined,
      liquidity: 0,
      spread: undefined,
      active: clob.active,
      closed: clob.closed,
      acceptingOrders: clob.acceptingOrders,
      endDate: clob.endDateIso ? new Date(clob.endDateIso) : new Date(),
      source: 'clob',
    };
  }

  // ===== Cache Management =====

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate cache for a specific market
   */
  invalidateMarketCache(conditionId: string): void {
    this.cache.invalidate(conditionId);
  }
}
