# @catalyst-team/poly-sdk

Unified SDK for Polymarket APIs - Data API, Gamma API, CLOB API, and WebSocket real-time updates.

## Installation

```bash
pnpm add @catalyst-team/poly-sdk
```

## Quick Start

```typescript
import { PolymarketSDK } from '@catalyst-team/poly-sdk';

const sdk = new PolymarketSDK();

// Get market by slug or condition ID
const market = await sdk.getMarket('will-trump-win-2024');
console.log(market.tokens.yes.price); // 0.65

// Get processed orderbook with analytics
const orderbook = await sdk.getOrderbook(market.conditionId);
console.log(orderbook.summary.longArbProfit); // Arbitrage opportunity

// Detect arbitrage
const arb = await sdk.detectArbitrage(market.conditionId);
if (arb) {
  console.log(`${arb.type} arb: ${arb.profit * 100}% profit`);
}
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                             PolymarketSDK                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│  Layer 3: Services                                                            │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────┐ ┌─────────────────────────┐│
│  │WalletService│ │MarketService│ │RealtimeService│ │   AuthorizationService  ││
│  │ - profiles  │ │ - K-Lines   │ │- subscriptions│ │   - ERC20 approvals     ││
│  │ - sell det. │ │ - signals   │ │- price cache  │ │   - ERC1155 approvals   ││
│  └─────────────┘ └─────────────┘ └───────────────┘ └─────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ ArbitrageService: Real-time arbitrage detection, rebalancer, settlement │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ SwapService: DEX swaps on Polygon (QuickSwap V3, USDC/USDC.e conversion)│  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│  Layer 2: API Clients                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────────┐  │
│  │ DataAPI  │ │ GammaAPI │ │ CLOB API │ │ WebSocket │ │   BridgeClient     │  │
│  │positions │ │ markets  │ │ orderbook│ │ real-time │ │   cross-chain      │  │
│  │ trades   │ │ events   │ │ trading  │ │ prices    │ │   deposits         │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘ └────────────────────┘  │
│  ┌──────────────────────────────────────┐ ┌────────────────────────────────┐  │
│  │ TradingClient: Order execution       │ │ CTFClient: On-chain operations │  │
│  │ GTC/GTD/FOK/FAK, rewards, balances   │ │ Split / Merge / Redeem tokens  │  │
│  └──────────────────────────────────────┘ └────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│  Layer 1: Infrastructure                                                      │
│  ┌────────────┐  ┌─────────┐  ┌──────────┐  ┌────────────┐ ┌──────────────┐   │
│  │RateLimiter │  │  Cache  │  │  Errors  │  │   Types    │ │ Price Utils  │   │
│  │per-API     │  │TTL-based│  │ retry    │  │ unified    │ │ arb detect   │   │
│  └────────────┘  └─────────┘  └──────────┘  └────────────┘ └──────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

## API Clients

### DataApiClient - Positions, Trades, Leaderboard

```typescript
// Get wallet positions
const positions = await sdk.dataApi.getPositions('0x...');

// Get recent trades
const trades = await sdk.dataApi.getTrades('0x...');

// Get leaderboard
const leaderboard = await sdk.dataApi.getLeaderboard();
```

### GammaApiClient - Markets, Events

```typescript
// Search markets
const markets = await sdk.gammaApi.searchMarkets({ query: 'bitcoin' });

// Get trending markets
const trending = await sdk.gammaApi.getTrendingMarkets(10);

// Get events
const events = await sdk.gammaApi.getEvents({ limit: 20 });
```

### ClobApiClient - Orderbook, Trading

```typescript
// Get orderbook
const book = await sdk.clobApi.getOrderbook(conditionId);

// Get processed orderbook with analytics
const processed = await sdk.clobApi.getProcessedOrderbook(conditionId);
console.log(processed.summary.longArbProfit);
console.log(processed.summary.shortArbProfit);
```

## Services

### WalletService - Smart Money Analysis

```typescript
// Get top traders
const traders = await sdk.wallets.getTopTraders(10);

// Get wallet profile with smart score
const profile = await sdk.wallets.getWalletProfile('0x...');
console.log(profile.smartScore); // 0-100

// Detect sell activity (for follow-wallet strategy)
const sellResult = await sdk.wallets.detectSellActivity(
  '0x...',
  conditionId,
  Date.now() - 24 * 60 * 60 * 1000
);
if (sellResult.isSelling) {
  console.log(`Sold ${sellResult.percentageSold}%`);
}

// Track group sell ratio
const groupSell = await sdk.wallets.trackGroupSellRatio(
  ['0x...', '0x...'],
  conditionId,
  peakValue,
  sinceTimestamp
);
```

### MarketService - K-Lines and Signals

```typescript
// Get K-Line candles
const klines = await sdk.markets.getKLines(conditionId, '1h', { limit: 100 });

// Get dual K-Lines (YES + NO) with spread analysis
const dual = await sdk.markets.getDualKLines(conditionId, '1h');
console.log(dual.yes);              // YES token candles
console.log(dual.no);               // NO token candles

// Historical spread (from trade close prices) - for backtesting
console.log(dual.spreadAnalysis);   // SpreadDataPoint[]
for (const point of dual.spreadAnalysis) {
  console.log(`${point.timestamp}: priceSum=${point.priceSum}, spread=${point.priceSpread}`);
  if (point.arbOpportunity) {
    console.log(`  Historical ${point.arbOpportunity} signal`);
  }
}

// Real-time spread (from orderbook) - for live trading
if (dual.realtimeSpread) {
  const rt = dual.realtimeSpread;
  console.log(`Ask Sum: ${rt.askSum} (spread: ${rt.askSpread})`);
  console.log(`Bid Sum: ${rt.bidSum} (spread: ${rt.bidSpread})`);
  if (rt.arbOpportunity) {
    console.log(`🎯 ${rt.arbOpportunity} ARB: ${rt.arbProfitPercent.toFixed(2)}% profit`);
  }
}

// Quick real-time spread check (without K-lines)
const spread = await sdk.markets.getRealtimeSpread(conditionId);
if (spread.longArbProfit > 0.005) {
  console.log(`Long arb: buy YES@${spread.yesAsk} + NO@${spread.noAsk}`);
}

// Detect market signals
const signals = await sdk.markets.detectMarketSignals(conditionId);
for (const signal of signals) {
  console.log(`${signal.type}: ${signal.severity}`);
}

// Detect arbitrage
const arb = await sdk.markets.detectArbitrage(conditionId);
```

#### Understanding Polymarket Orderbook & Arbitrage

⚠️ **重要：Polymarket 订单簿的镜像特性**

Polymarket 的订单簿有一个关键特性容易被忽略：

```
买 YES @ P = 卖 NO @ (1-P)
```

这意味着**同一订单会在两个订单簿中出现**。例如，一个 "Sell NO @ 0.50" 订单
会同时作为 "Buy YES @ 0.50" 出现在 YES 订单簿中。

**常见误解：**
```typescript
// ❌ 错误: 简单相加会重复计算镜像订单
const askSum = YES.ask + NO.ask;  // ≈ 1.998-1.999，而非 ≈ 1.0
const bidSum = YES.bid + NO.bid;  // ≈ 0.001-0.002，而非 ≈ 1.0
```

**正确做法：使用有效价格 (Effective Prices)**
```typescript
import { getEffectivePrices, checkArbitrage } from '@catalyst-team/poly-sdk';

// 计算考虑镜像后的最优价格
const effective = getEffectivePrices(yesAsk, yesBid, noAsk, noBid);

// effective.effectiveBuyYes = min(YES.ask, 1 - NO.bid)
// effective.effectiveBuyNo = min(NO.ask, 1 - YES.bid)
// effective.effectiveSellYes = max(YES.bid, 1 - NO.ask)
// effective.effectiveSellNo = max(NO.bid, 1 - YES.ask)

// 使用有效价格检测套利
const arb = checkArbitrage(yesAsk, noAsk, yesBid, noBid);
if (arb) {
  console.log(`${arb.type} arb: ${(arb.profit * 100).toFixed(2)}% profit`);
  console.log(arb.description);
}
```

详细文档见: [docs/01-polymarket-orderbook-arbitrage.md](docs/01-polymarket-orderbook-arbitrage.md)

#### Spread Analysis - Two Approaches

我们提供两种 Spread 分析方式，核心区别如下：

```
┌─────────────────────────────────────────────────────────────────────────┐
│  spreadAnalysis (历史分析)           │  realtimeSpread (实时分析)        │
├─────────────────────────────────────────────────────────────────────────┤
│  数据源: 成交记录的收盘价             │  数据源: 订单簿的最优 bid/ask     │
│  YES_close + NO_close               │  使用有效价格 (考虑镜像订单)       │
├─────────────────────────────────────────────────────────────────────────┤
│  ✅ 可构建历史曲线                   │  ❌ 无法构建历史曲线*              │
│  ✅ Polymarket 保留成交历史          │  ❌ Polymarket 不保留盘口历史     │
│  ✅ 适合回测、模式识别               │  ✅ 适合实盘交易、套利执行         │
│  ⚠️ 套利信号仅供参考                 │  ✅ 套利利润计算准确              │
└─────────────────────────────────────────────────────────────────────────┘

* 如需构建实时 Spread 的历史曲线，必须自行存储盘口快照数据
  参考: apps/api/src/services/spread-sampler.ts
```

**核心区别：**

1. **成交价 vs 盘口价**
   - 成交价 (close): 过去某时刻实际成交的价格
   - 盘口价 (bid/ask): 当前市场上的最优挂单价格
   - 例: YES 最后成交 0.52，但当前 bid=0.50, ask=0.54

2. **为什么套利计算需要有效价格？**
   - 同一订单在 YES 和 NO 订单簿中都有镜像
   - 简单的 `YES.ask + NO.ask` 会重复计算
   - 必须用 `min(YES.ask, 1-NO.bid)` 等公式消除重复

3. **为什么历史分析只能用成交价？**
   - Polymarket CLOB API 不保存历史盘口数据
   - 只有成交记录 (trades) 有历史
   - 除非你自己运行 spread-sampler 持续采样盘口

```typescript
// SpreadDataPoint (历史分析 - 可构建曲线)
interface SpreadDataPoint {
  timestamp: number;
  yesPrice: number;      // YES 收盘价 (来自成交记录)
  noPrice: number;       // NO 收盘价
  priceSum: number;      // YES + NO
  priceSpread: number;   // priceSum - 1 (偏离均衡程度)
  arbOpportunity: 'LONG' | 'SHORT' | '';  // 参考信号
}

// ProcessedOrderbook.summary (实时分析 - 使用有效价格)
interface OrderbookSummary {
  // 有效价格 (考虑镜像订单)
  effectivePrices: {
    effectiveBuyYes: number;   // min(YES.ask, 1 - NO.bid)
    effectiveBuyNo: number;    // min(NO.ask, 1 - YES.bid)
    effectiveSellYes: number;  // max(YES.bid, 1 - NO.ask)
    effectiveSellNo: number;   // max(NO.bid, 1 - YES.ask)
  };
  // 套利成本/收入
  effectiveLongCost: number;    // effectiveBuyYes + effectiveBuyNo
  effectiveShortRevenue: number; // effectiveSellYes + effectiveSellNo
  // 套利利润
  longArbProfit: number;  // 1 - effectiveLongCost (> 0 可套利)
  shortArbProfit: number; // effectiveShortRevenue - 1 (> 0 可套利)
  yesSpread: number;      // YES.ask - YES.bid (市场效率指标)
}
```

### TradingClient - Order Execution

```typescript
import { TradingClient, RateLimiter } from '@catalyst-team/poly-sdk';

const rateLimiter = new RateLimiter();
const tradingClient = new TradingClient(rateLimiter, {
  privateKey: process.env.POLYMARKET_PRIVATE_KEY!,
});

await tradingClient.initialize();
console.log(`Wallet: ${tradingClient.getAddress()}`);

// GTC Limit Order (stays until filled or cancelled)
const order = await tradingClient.createOrder({
  tokenId: yesTokenId,
  side: 'BUY',
  price: 0.45,
  size: 10,
  orderType: 'GTC',
});

// GTD Limit Order (expires at timestamp)
const gtdOrder = await tradingClient.createOrder({
  tokenId: yesTokenId,
  side: 'BUY',
  price: 0.45,
  size: 10,
  orderType: 'GTD',
  expiration: Math.floor(Date.now() / 1000) + 3600, // 1 hour
});

// FOK Market Order (fill entirely or cancel)
const marketOrder = await tradingClient.createMarketOrder({
  tokenId: yesTokenId,
  side: 'BUY',
  amount: 10, // $10 USDC
  orderType: 'FOK',
});

// FAK Market Order (partial fill ok)
const fakOrder = await tradingClient.createMarketOrder({
  tokenId: yesTokenId,
  side: 'SELL',
  amount: 10, // 10 shares
  orderType: 'FAK',
});

// Order management
const openOrders = await tradingClient.getOpenOrders();
await tradingClient.cancelOrder(orderId);
await tradingClient.cancelAllOrders();

// Get trade history
const trades = await tradingClient.getTrades();
```

### Rewards - Market Making Incentives

```typescript
// Check if your orders are earning rewards
const isScoring = await tradingClient.isOrderScoring(orderId);

// Get markets with active reward programs
const rewards = await tradingClient.getCurrentRewards();
for (const reward of rewards) {
  console.log(`${reward.question}`);
  console.log(`  Max Spread: ${reward.rewardsMaxSpread}`);
  console.log(`  Min Size: ${reward.rewardsMinSize}`);
}

// Get your daily earnings
const earnings = await tradingClient.getTotalEarningsForDay('2024-12-07');
console.log(`Total earned: $${earnings.totalEarnings}`);

// Check balance and allowance
const balance = await tradingClient.getBalanceAllowance('COLLATERAL');
console.log(`USDC Balance: ${balance.balance}`);
```

### RealtimeService - WebSocket Subscriptions

⚠️ **重要：Orderbook 自动排序**

Polymarket CLOB API 返回的 orderbook 顺序与标准预期相反：
- **bids**: 升序排列 (最低价在前 = 最差价)
- **asks**: 降序排列 (最高价在前 = 最差价)

我们的 SDK **自动规范化** orderbook 数据：
- **bids**: 降序排列 (最高价在前 = 最佳买价)
- **asks**: 升序排列 (最低价在前 = 最佳卖价)

这意味着你可以安全地使用 `bids[0]` 和 `asks[0]` 获取最优价格：

```typescript
const book = await sdk.clobApi.getOrderbook(conditionId);
const bestBid = book.bids[0]?.price;  // ✅ 最高买价 (最佳 bid)
const bestAsk = book.asks[0]?.price;  // ✅ 最低卖价 (最佳 ask)

// WebSocket 更新同样自动排序
wsManager.on('bookUpdate', (update) => {
  const bestBid = update.bids[0]?.price;  // ✅ 已排序
  const bestAsk = update.asks[0]?.price;  // ✅ 已排序
});
```

```typescript
import { WebSocketManager, RealtimeService } from '@catalyst-team/poly-sdk';

const wsManager = new WebSocketManager();
const realtime = new RealtimeService(wsManager);

// Subscribe to market updates
const subscription = await realtime.subscribeMarket(yesTokenId, noTokenId, {
  onPriceUpdate: (update) => {
    console.log(`${update.assetId}: ${update.price}`);
  },
  onBookUpdate: (update) => {
    console.log(`Best bid: ${update.bids[0]?.price}`);
  },
  onLastTrade: (trade) => {
    console.log(`Trade: ${trade.side} ${trade.size} @ ${trade.price}`);
  },
  onPairUpdate: (update) => {
    console.log(`YES + NO = ${update.spread}`);
    if (update.spread < 0.99) console.log('ARB opportunity!');
  },
});

// Get cached prices
const price = realtime.getPrice(yesTokenId);

// Cleanup
await subscription.unsubscribe();
```

### CTFClient - On-Chain Token Operations (Split/Merge/Redeem)

The CTF (Conditional Token Framework) client enables on-chain operations for Polymarket's conditional tokens.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CTF 核心操作快速参考                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  操作         │ 功能                    │ 典型场景                           │
├──────────────┼────────────────────────┼──────────────────────────────────────┤
│  Split       │ USDC → YES + NO        │ 市场做市：创建代币库存                 │
│  Merge       │ YES + NO → USDC        │ 套利：买入双边后合并获利               │
│  Redeem      │ 胜出代币 → USDC         │ 结算：市场结束后兑换获胜代币            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**核心用途：**
- **Arbitrage (套利)**: 当 YES + NO 买入成本 < $1 时，Merge 获利
- **Market Making (做市)**: Split USDC 创建代币库存进行双边报价
- **Redemption (结算)**: 市场结束后 Redeem 胜出代币获取 USDC

```typescript
import { CTFClient, CTF_CONTRACT, USDC_CONTRACT } from '@catalyst-team/poly-sdk';

const ctf = new CTFClient({
  privateKey: process.env.POLYMARKET_PRIVATE_KEY!,
  rpcUrl: 'https://polygon-rpc.com', // optional
});

console.log(`Wallet: ${ctf.getAddress()}`);
console.log(`USDC Balance: ${await ctf.getUsdcBalance()}`);
```

#### Split: USDC → YES + NO Tokens

```typescript
// Split 100 USDC into 100 YES + 100 NO tokens
const splitResult = await ctf.split(conditionId, '100');
console.log(`TX: ${splitResult.txHash}`);
console.log(`Created ${splitResult.yesTokens} YES + ${splitResult.noTokens} NO`);
```

#### Merge: YES + NO → USDC

⚠️ **重要：两种 Merge 方法**

| 方法 | 适用场景 | 推荐 |
|------|----------|------|
| `mergeByTokenIds()` | **Polymarket CLOB 市场** | ✅ 推荐 |
| `merge()` | 标准 Gnosis CTF 市场 | ❌ Polymarket 慎用 |

```typescript
// ✅ 推荐：Polymarket 市场使用 mergeByTokenIds
const tokenIds = {
  yesTokenId: market.tokens[0].tokenId,  // 从 CLOB API 获取
  noTokenId: market.tokens[1].tokenId,
};
const mergeResult = await ctf.mergeByTokenIds(conditionId, tokenIds, '100');
console.log(`TX: ${mergeResult.txHash}`);
console.log(`Received ${mergeResult.usdcReceived} USDC`);

// ⚠️ 标准 CTF 方法（可能无法正确检查 Polymarket 余额）
// const mergeResult = await ctf.merge(conditionId, '100');
```

#### Redeem: Winning Tokens → USDC

⚠️ **重要：两种 Redeem 方法**

Polymarket 使用自定义的 token ID，与标准 CTF position ID 计算方式不同：

| 方法 | 适用场景 | Token ID 来源 |
|------|----------|---------------|
| `redeemByTokenIds()` | **Polymarket CLOB 市场** ✅ | CLOB API 返回的 tokenId |
| `redeem()` | 标准 Gnosis CTF 市场 | `keccak256(collectionId, conditionId, indexSet)` |

```typescript
// ✅ 推荐：Polymarket 市场使用 redeemByTokenIds
const tokenIds = {
  yesTokenId: '25064375110792967023484002819116042931016336431092144471807003884255851454283',
  noTokenId: '98190367690492181203391990709979106077460946443309150166954079213761598385827',
};
const result = await ctf.redeemByTokenIds(conditionId, tokenIds);
console.log(`Redeemed ${result.tokensRedeemed} ${result.outcome} tokens`);
console.log(`Received ${result.usdcReceived} USDC`);

// ❌ 不要用于 Polymarket：redeem() 使用计算的 position ID
// const result = await ctf.redeem(conditionId);  // 可能找不到余额
```

**为什么 Polymarket token ID 不同？**
- Polymarket 在 CTF 之上包装了一层 ERC-1155 tokens
- CLOB API 返回的 `tokenId` (如 `"25064375..."`) 与标准 CTF 计算的 position ID 不同
- 必须使用 CLOB API 的 token ID 才能正确查询余额和 redeem

#### Position Queries

```typescript
// Get token balances
const balances = await ctf.getPositionBalance(conditionId);
console.log(`YES: ${balances.yesBalance}, NO: ${balances.noBalance}`);

// Check if market is resolved
const resolution = await ctf.getMarketResolution(conditionId);
if (resolution.isResolved) {
  console.log(`Winner: ${resolution.winningOutcome}`);
}

// Gas estimation
const splitGas = await ctf.estimateSplitGas(conditionId, '100');
const mergeGas = await ctf.estimateMergeGas(conditionId, '100');
```

#### Arbitrage Flow

⚠️ **注意：必须使用有效价格计算套利，不能简单相加 ask/bid**

由于 Polymarket 的镜像订单特性（见上文），正确的套利计算方式如下：

```
┌─────────────────────────────────────────────────────────────┐
│ LONG ARB (effectiveLongCost < $1):                          │
│   有效买入成本:                                               │
│     effectiveBuyYes = min(YES.ask, 1 - NO.bid)              │
│     effectiveBuyNo = min(NO.ask, 1 - YES.bid)               │
│   操作:                                                      │
│     1. 用有效价格买入 YES + NO                               │
│     2. CTF Merge → $1 USDC                                  │
│     3. Profit = 1 - effectiveLongCost                       │
├─────────────────────────────────────────────────────────────┤
│ SHORT ARB (effectiveShortRevenue > $1):                      │
│   有效卖出收入:                                               │
│     effectiveSellYes = max(YES.bid, 1 - NO.ask)             │
│     effectiveSellNo = max(NO.bid, 1 - YES.ask)              │
│   操作:                                                      │
│     1. CTF Split $1 → 1 YES + 1 NO                          │
│     2. 用有效价格卖出 YES + NO                               │
│     3. Profit = effectiveShortRevenue - 1                   │
└─────────────────────────────────────────────────────────────┘
```

```typescript
import { checkArbitrage, getEffectivePrices } from '@catalyst-team/poly-sdk';

// checkArbitrage 内部使用有效价格计算
const arb = checkArbitrage(yesAsk, noAsk, yesBid, noBid);
if (arb?.type === 'long') {
  console.log(arb.description); // "Buy YES @ 0.48 + NO @ 0.50, Merge for $1"
  // Buy both tokens at effective prices, then merge
  await tradingClient.createMarketOrder({ tokenId: yesTokenId, side: 'BUY', amount: 100 });
  await tradingClient.createMarketOrder({ tokenId: noTokenId, side: 'BUY', amount: 100 });
  await ctf.merge(conditionId, '100');
}
```

### BridgeClient - Cross-Chain Deposits

Bridge assets from multiple chains (Ethereum, Solana, Bitcoin) to Polygon USDC.e for Polymarket trading.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  跨链充值流程                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. 获取充值地址 → 2. 发送资产到地址 → 3. 自动桥接 → 4. USDC.e 到账           │
└─────────────────────────────────────────────────────────────────────────────┘
```

```typescript
import {
  BridgeClient,
  SUPPORTED_CHAINS,
  depositUsdc,
  swapAndDeposit,
} from '@catalyst-team/poly-sdk';

// Get deposit addresses for your wallet
const bridge = new BridgeClient();
const addresses = await bridge.createDepositAddresses(walletAddress);
console.log(`EVM chains: ${addresses.address.evm}`);
console.log(`Solana: ${addresses.address.svm}`);
console.log(`Bitcoin: ${addresses.address.btc}`);

// Get supported assets
const assets = await bridge.getSupportedAssets();
for (const asset of assets) {
  console.log(`${asset.chainName} ${asset.tokenSymbol}: min ${asset.minDepositUsd} USD`);
}

// Direct USDC deposit from Ethereum
const depositResult = await depositUsdc(signer, '100', walletAddress);
console.log(`Deposited: ${depositResult.txHash}`);

// Swap ETH to USDC and deposit
const swapResult = await swapAndDeposit(signer, {
  tokenIn: 'ETH',
  amountIn: '0.1',
  targetAddress: walletAddress,
});
console.log(`Swapped & deposited: ${swapResult.usdcAmount}`);
```

### SwapService - DEX Swaps on Polygon

Swap tokens on Polygon using QuickSwap V3. Essential for converting tokens to USDC.e for CTF operations.

⚠️ **USDC vs USDC.e for Polymarket CTF**

| Token | Address | Polymarket CTF |
|-------|---------|----------------|
| USDC.e | `0x2791...` | ✅ **Required** |
| USDC (Native) | `0x3c49...` | ❌ Not accepted |

```typescript
import { SwapService, POLYGON_TOKENS } from '@catalyst-team/poly-sdk';

const swapService = new SwapService(signer);

// Check balances
const balances = await swapService.getBalances();
for (const b of balances) {
  console.log(`${b.symbol}: ${b.balance}`);
}

// Swap native USDC to USDC.e for CTF operations
const swapResult = await swapService.swap('USDC', 'USDC_E', '100');
console.log(`Swapped: ${swapResult.amountOut} USDC.e`);

// Swap MATIC to USDC.e
const maticSwap = await swapService.swap('MATIC', 'USDC_E', '50');

// Get quote before swapping
const quote = await swapService.getQuote('WETH', 'USDC_E', '0.1');
console.log(`Expected output: ${quote.estimatedAmountOut} USDC.e`);

// Transfer USDC.e (for CTF operations)
await swapService.transferUsdcE(recipientAddress, '100');
```

### AuthorizationService - Trading Approvals

Manage ERC20 and ERC1155 approvals required for trading on Polymarket.

```typescript
import { AuthorizationService } from '@catalyst-team/poly-sdk';

const authService = new AuthorizationService(signer);

// Check all allowances
const status = await authService.checkAllowances();
console.log(`Wallet: ${status.wallet}`);
console.log(`USDC Balance: ${status.usdcBalance}`);
console.log(`Trading Ready: ${status.tradingReady}`);

if (!status.tradingReady) {
  console.log('Issues:', status.issues);

  // Set up all required approvals
  const result = await authService.approveAll();
  console.log(result.summary);
}

// Check individual allowances
for (const allowance of status.erc20Allowances) {
  console.log(`${allowance.contract}: ${allowance.approved ? '✅' : '❌'}`);
}
```

### ArbitrageService - 套利服务

实时套利检测与执行，支持市场扫描、自动再平衡、智能清仓。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  核心功能                                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  • scanMarkets()     - 扫描市场找套利机会                                      │
│  • start(market)     - 启动实时监控 + 自动执行                                 │
│  • clearPositions()  - 智能清仓 (活跃市场卖出, 已结算市场 redeem)                │
├─────────────────────────────────────────────────────────────────────────────┤
│  自动再平衡 (Rebalancer)                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  套利需要 USDC + YES/NO Token，Rebalancer 自动维持资金比例：                    │
│  • USDC 比例 < 20%  → 自动 Merge (YES+NO → USDC)                             │
│  • USDC 比例 > 80%  → 自动 Split (USDC → YES+NO)                             │
│  • 冷却机制：两次操作间隔 ≥ 30s，检测间隔 10s                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  执行安全 (Partial Fill Protection)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  套利需要同时买入 YES 和 NO，但订单可能部分成交：                                 │
│  • sizeSafetyFactor=0.8 → 只使用 80% 的盘口深度，降低滑点风险                   │
│  • autoFixImbalance=true → 如果只成交一侧，自动卖出多余的 token                 │
│  • imbalanceThreshold=5 → YES-NO 差额超过 $5 时触发修复                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 完整工作流

```typescript
import { ArbitrageService } from '@catalyst-team/poly-sdk';

const arbService = new ArbitrageService({
  privateKey: process.env.POLY_PRIVKEY,
  profitThreshold: 0.005,  // 0.5% minimum profit
  minTradeSize: 5,         // $5 minimum
  maxTradeSize: 100,       // $100 maximum
  autoExecute: true,       // Automatically execute opportunities

  // Rebalancer config
  enableRebalancer: true,  // Auto-rebalance position
  minUsdcRatio: 0.2,       // Min 20% USDC (Split if below)
  maxUsdcRatio: 0.8,       // Max 80% USDC (Merge if above)
  targetUsdcRatio: 0.5,    // Target 50% when rebalancing
  imbalanceThreshold: 5,   // Max YES-NO difference before fix
  rebalanceInterval: 10000, // Check every 10s
  rebalanceCooldown: 30000, // Min 30s between actions

  // Execution safety (prevents YES ≠ NO from partial fills)
  sizeSafetyFactor: 0.8,   // Use 80% of orderbook depth
  autoFixImbalance: true,  // Auto-sell excess if one side fails
});

// Listen for events
arbService.on('opportunity', (opp) => {
  console.log(`${opp.type.toUpperCase()} ARB: ${opp.profitPercent.toFixed(2)}%`);
});

arbService.on('execution', (result) => {
  if (result.success) {
    console.log(`✅ Executed: $${result.profit.toFixed(2)} profit`);
  }
});

arbService.on('rebalance', (result) => {
  console.log(`🔄 Rebalance: ${result.action.type} ${result.action.amount}`);
});

// ========== Step 1: 扫描市场 ==========
const results = await arbService.scanMarkets({ minVolume24h: 5000 }, 0.005);
console.log(`Found ${results.filter(r => r.arbType !== 'none').length} opportunities`);

// 或者一键扫描+启动最佳市场
const best = await arbService.findAndStart(0.005);
if (!best) {
  console.log('No arbitrage opportunities found');
  process.exit(0);
}
console.log(`🎯 Started: ${best.market.name} (+${best.profitPercent.toFixed(2)}%)`);

// ========== Step 2: 运行套利 ==========
// 服务现在自动监控并执行套利...
// 运行一段时间后:
await new Promise(resolve => setTimeout(resolve, 60 * 60 * 1000)); // 1 hour

// ========== Step 3: 停止并清算 ==========
await arbService.stop();
console.log('Stats:', arbService.getStats());

// 智能清仓: 活跃市场 merge+sell, 已结算市场 redeem
const clearResult = await arbService.clearPositions(best.market, true);
console.log(`✅ Recovered: $${clearResult.totalUsdcRecovered.toFixed(2)}`);
```

#### 手动选择市场

```typescript
// 如果不用 scanMarkets，可以手动构建 market config
const market = {
  name: 'Will BTC reach $100k?',
  conditionId: '0x...',
  yesTokenId: '12345...',
  noTokenId: '67890...',
  outcomes: ['Yes', 'No'] as [string, string],
};

await arbService.start(market);
```

#### 批量清仓

```typescript
// 多个市场一起清仓
const markets = [market1, market2, market3];
const results = await arbService.clearAllPositions(markets, true);
const total = results.reduce((sum, r) => sum + r.totalUsdcRecovered, 0);
console.log(`Total recovered: $${total.toFixed(2)}`);
```

#### 仅监控模式

```typescript
// No private key = monitoring only, no execution
const arbService = new ArbitrageService({
  profitThreshold: 0.003,
  enableLogging: true,
});

arbService.on('opportunity', (opp) => {
  // Log opportunities for analysis without executing
  console.log(`Found ${opp.type} arb: ${opp.profitPercent.toFixed(2)}%`);
  console.log(`  ${opp.description}`);
});

await arbService.start(market);
```

## Price Utilities

```typescript
import {
  roundPrice,
  validatePrice,
  calculateBuyAmount,
  getEffectivePrices,  // For Polymarket mirror orderbook
  checkArbitrage,
  formatUSDC,
  calculatePnL,
  type TickSize,
} from '@catalyst-team/poly-sdk';

// Round price to tick size
const tickSize: TickSize = '0.01';
roundPrice(0.523, tickSize, 'floor'); // 0.52
roundPrice(0.523, tickSize, 'ceil');  // 0.53

// Validate price
const validation = validatePrice(0.525, tickSize);
if (!validation.valid) {
  console.log(validation.error);
}

// Calculate order cost
const cost = calculateBuyAmount(0.52, 100); // $52
console.log(formatUSDC(cost)); // "$52.00"

// Get effective prices (considering Polymarket mirror orders)
const effective = getEffectivePrices(yesAsk, yesBid, noAsk, noBid);
console.log(`Effective buy YES: ${effective.effectiveBuyYes}`);  // min(YES.ask, 1 - NO.bid)
console.log(`Effective buy NO: ${effective.effectiveBuyNo}`);    // min(NO.ask, 1 - YES.bid)

// Check for arbitrage (uses effective prices internally)
const arb = checkArbitrage(
  yesAsk, noAsk,  // Ask prices
  yesBid, noBid   // Bid prices
);
if (arb) {
  console.log(`${arb.type} arb: ${(arb.profit * 100).toFixed(2)}% profit`);
  console.log(arb.description);  // "Buy YES @ 0.48 + NO @ 0.50, Merge for $1"
}

// Calculate PnL
const pnl = calculatePnL(0.40, 0.55, 100, 'long');
console.log(`PnL: ${formatUSDC(pnl.pnl)} (${pnl.pnlPercent.toFixed(1)}%)`);
```

## K-Line Intervals

Supported intervals: `30s`, `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `12h`, `1d`

```typescript
import type { KLineInterval } from '@catalyst-team/poly-sdk';

const interval: KLineInterval = '1h';
const candles = await sdk.markets.getKLines(conditionId, interval);
```

## Types

```typescript
import type {
  // Core
  UnifiedMarket,
  PriceUpdate,
  BookUpdate,
  ProcessedOrderbook,
  ArbitrageOpportunity,
  EffectivePrices,           // Effective prices for Polymarket mirror orderbook

  // K-Lines & Spread
  KLineInterval,
  KLineCandle,
  DualKLineData,
  SpreadDataPoint,           // Historical spread (trade prices)

  // Wallet
  WalletProfile,
  SellActivityResult,

  // Trading
  Side,
  OrderType,
  OrderParams,
  MarketOrderParams,
  Order,
  OrderResult,
  TradeInfo,

  // Rewards
  UserEarning,
  MarketReward,

  // CTF
  CTFConfig,
  SplitResult,
  MergeResult,
  RedeemResult,
  PositionBalance,
  MarketResolution,
  TokenIds,

  // Bridge
  BridgeSupportedAsset,
  DepositAddress,
  DepositStatus,
  DepositResult,
  SwapAndDepositResult,

  // Swap
  SupportedToken,
  SwapQuote,
  SwapResult,
  TokenBalance,

  // Authorization
  AllowanceInfo,
  AllowancesResult,
  ApprovalTxResult,

  // ArbitrageService
  ArbitrageMarketConfig,
  ArbitrageServiceConfig,
  ArbitrageServiceOpportunity,
  ArbitrageExecutionResult,
  OrderbookState,
  BalanceState,
  RebalanceAction,
  RebalanceResult,
  SettleResult,
  // ArbitrageService - Scanning
  ScanCriteria,
  ScanResult,
  // ArbitrageService - Smart clearing
  ClearPositionResult,
  ClearAction,

  // Price Utils
  TickSize,

  // API types
  Position,
  Trade,
  LeaderboardEntry,
  GammaMarket,
  ClobMarket,
  Orderbook,
} from '@catalyst-team/poly-sdk';
```

## Error Handling

```typescript
import { PolymarketError, ErrorCode, withRetry } from '@catalyst-team/poly-sdk';

try {
  const market = await sdk.getMarket('invalid-slug');
} catch (error) {
  if (error instanceof PolymarketError) {
    if (error.code === ErrorCode.MARKET_NOT_FOUND) {
      console.log('Market not found');
    } else if (error.code === ErrorCode.RATE_LIMITED) {
      console.log('Rate limited, retry later');
    }
  }
}

// Auto-retry with exponential backoff
const result = await withRetry(() => sdk.getMarket(slug), {
  maxRetries: 3,
  baseDelay: 1000,
});
```

## Rate Limiting

Built-in rate limiting per API type:
- Data API: 10 req/sec
- Gamma API: 10 req/sec
- CLOB API: 5 req/sec

```typescript
import { RateLimiter, ApiType } from '@catalyst-team/poly-sdk';

// Custom rate limiter
const limiter = new RateLimiter({
  [ApiType.DATA]: { maxConcurrent: 5, minTime: 200 },
  [ApiType.GAMMA]: { maxConcurrent: 5, minTime: 200 },
  [ApiType.CLOB]: { maxConcurrent: 2, minTime: 500 },
});
```

## Caching

Built-in TTL-based caching:

```typescript
// Clear all cache
sdk.clearCache();

// Invalidate specific market
sdk.invalidateMarketCache(conditionId);
```

## Examples

| Example | Description | Source |
|---------|-------------|--------|
| [Basic Usage](examples/01-basic-usage.ts) | Get markets, orderbooks, detect arbitrage | `pnpm example:basic` |
| [Smart Money](examples/02-smart-money.ts) | Top traders, wallet profiles, smart scores | `pnpm example:smart-money` |
| [Market Analysis](examples/03-market-analysis.ts) | Market signals, volume analysis | `pnpm example:market-analysis` |
| [K-Line Aggregation](examples/04-kline-aggregation.ts) | Build OHLCV candles from trades | `pnpm example:kline` |
| [Follow Wallet](examples/05-follow-wallet-strategy.ts) | Track smart money positions, detect exits | `pnpm example:follow-wallet` |
| [Services Demo](examples/06-services-demo.ts) | All SDK services in action | `pnpm example:services` |
| [Realtime WebSocket](examples/07-realtime-websocket.ts) | Live price feeds, orderbook updates | `pnpm example:realtime` |
| [Trading Orders](examples/08-trading-orders.ts) | GTC, GTD, FOK, FAK order types | `pnpm example:trading` |
| [Rewards Tracking](examples/09-rewards-tracking.ts) | Market maker incentives, earnings | `pnpm example:rewards` |
| [CTF Operations](examples/10-ctf-operations.ts) | Split, merge, redeem tokens | `pnpm example:ctf` |
| [Live Arbitrage Scan](examples/11-live-arbitrage-scan.ts) | Scan real markets for opportunities | `pnpm example:live-arb` |
| [Trending Arb Monitor](examples/12-trending-arb-monitor.ts) | Real-time trending markets monitor | `pnpm example:trending-arb` |

Run any example:

```bash
pnpm example:basic
pnpm example:smart-money
pnpm example:trading
# etc.
```

## Dependencies

- `@nevuamarkets/poly-websockets` - WebSocket client
- `bottleneck` - Rate limiting
- `ethers` - Blockchain interactions (for CTFClient)

## License

Private
