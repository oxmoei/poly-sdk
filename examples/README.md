# Poly-SDK 示例

全面展示 Polymarket SDK 功能的示例代码。

## 运行示例

```bash
# 从 poly-sdk 目录
npx tsx examples/01-basic-usage.ts

# 或使用 pnpm 脚本
pnpm example:basic       # 01-basic-usage.ts
pnpm example:smart-money # 02-smart-money.ts
```

---

## 示例概览

| # | 文件 | 描述 | 需要认证 |
|---|------|------|----------|
| 01 | `basic-usage.ts` | 热门市场、订单簿数据 | 否 |
| 02 | `smart-money.ts` | 聪明钱钱包分析 | 否 |
| 03 | `market-analysis.ts` | 市场搜索和分析 | 否 |
| 04 | `kline-aggregation.ts` | 价格历史和 K 线数据 | 否 |
| 05 | `follow-wallet-strategy.ts` | 跟单交易模拟 | 否 |
| 06 | `services-demo.ts` | WalletService & MarketService | 否 |
| 07 | `realtime-websocket.ts` | 实时订单簿更新 | 否 |
| 08 | `trading-orders.ts` | 订单下单和管理 | 是 |
| 09 | `rewards-tracking.ts` | 流动性奖励追踪 | 是 |
| 10 | `ctf-operations.ts` | 拆分/合并/赎回代币 | 是 |
| 11 | `live-arbitrage-scan.ts` | 扫描市场套利机会 | 否 |
| 12 | `trending-arb-monitor.ts` | 实时套利监控 | 否 |
| 13 | `arbitrage-service.ts` | 完整的 ArbitrageService 工作流 | 是 |

---

## 示例详情

### 01 - 基础使用

SDK 入门示例。获取热门市场和订单簿数据。

```typescript
import { PolymarketSDK } from '@catalyst-team/poly-sdk';
const sdk = new PolymarketSDK();
const trending = await sdk.gammaApi.getTrendingMarkets(5);
```

### 02 - 聪明钱分析

分析钱包交易表现，识别盈利交易者。

- 获取钱包持仓和活动
- 计算盈亏和胜率
- 识别高表现钱包

### 03 - 市场分析

通过各种条件搜索和分析市场。

- 关键词搜索
- 按成交量、流动性筛选
- 分析市场价差

### 04 - K 线聚合

获取用于图表展示的价格历史。

- 多时间周期蜡烛图（1分钟、5分钟、1小时、1天）
- OHLCV 数据
- YES/NO 双重价格追踪

### 05 - 跟随钱包策略

基于聪明钱信号模拟跟单交易。

- 监控钱包活动
- 生成交易信号
- 回测策略表现

### 06 - 服务演示

高级服务抽象。

- `WalletService` - 钱包分析辅助工具
- `MarketService` - 市场数据聚合

### 07 - 实时 WebSocket

使用 `RealtimeServiceV2` 进行实时市场数据流传输。

- 连接到 Polymarket WebSocket（官方客户端）
- 实时订单簿更新
- 价格变动事件
- 最新交易通知
- 加密货币价格订阅（BTC、ETH）

```typescript
import { RealtimeServiceV2 } from '@catalyst-team/poly-sdk';

const realtime = new RealtimeServiceV2({ debug: false });
realtime.connect();

realtime.once('connected', () => {
  const sub = realtime.subscribeMarket(yesTokenId, noTokenId, {
    onOrderbook: (book) => console.log('Book:', book),
    onPriceUpdate: (update) => console.log('Price:', update),
  });
});
```

### 08 - 交易订单

使用 `TradingService` 进行交易功能（需要私钥）。

```bash
POLYMARKET_PRIVATE_KEY=0x... npx tsx examples/08-trading-orders.ts
```

- 市场数据：`getMarket()`、`getOrderbook()`、`getPricesHistory()`
- 创建限价/市价订单：`createLimitOrder()`、`createMarketOrder()`
- 取消订单：`cancelOrder()`、`cancelAllOrders()`
- 检查订单状态：`getOpenOrders()`、`getTrades()`
- 奖励：`getCurrentRewards()`、`isOrderScoring()`

### 09 - 奖励追踪

使用 `TradingService` 追踪流动性提供者奖励。

- 查找有活跃奖励的市场
- 检查订单是否在计分
- 追踪每日收益

### 10 - CTF 操作

链上代币操作（需要私钥 + USDC.e）。

```bash
POLYMARKET_PRIVATE_KEY=0x... npx tsx examples/10-ctf-operations.ts
```

**重要提示：** 使用 USDC.e（非原生 USDC）：
| 代币 | 地址 | CTF 兼容 |
|------|------|----------|
| USDC.e | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | 是 |
| 原生 USDC | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | 否 |

操作：
- **拆分**：USDC.e → YES + NO 代币
- **合并**：YES + NO → USDC.e（套利利润）
- **赎回**：获胜代币 → USDC.e

### 11 - 实时套利扫描

扫描市场寻找套利机会（只读）。

- 获取活跃市场
- 计算有效价格
- 检测多空套利机会

### 12 - 热门套利监控

持续监控热门市场。

- 实时订单簿分析
- 正确的有效价格计算
- 可配置扫描间隔

### 13 - ArbitrageService 完整工作流

使用 `ArbitrageService` 的完整套利工作流（需要私钥）。

```bash
POLYMARKET_PRIVATE_KEY=0x... npx tsx examples/13-arbitrage-service.ts
```

- **ArbitrageService**：用于套利检测和执行的高级 API
- 可配置条件的市场扫描
- 实时 WebSocket 监控
- 带利润阈值的自动执行
- 持仓清算和结算

---

## 套利概念

Polymarket 订单簿具有镜像属性：
- **以价格 P 买入 YES = 以价格 (1-P) 卖出 NO**

正确的有效价格：
```
effectiveBuyYes = min(YES.ask, 1 - NO.bid)
effectiveBuyNo = min(NO.ask, 1 - YES.bid)
effectiveSellYes = max(YES.bid, 1 - NO.ask)
effectiveSellNo = max(NO.bid, 1 - YES.ask)
```

| 套利类型 | 条件 | 操作 |
|----------|------|------|
| 多头套利 | `effectiveBuyYes + effectiveBuyNo < 1` | 买入两者，合并获得 $1 |
| 空头套利 | `effectiveSellYes + effectiveSellNo > 1` | 拆分 $1，卖出两者 |

---

## 环境变量

| 变量 | 描述 | 用于示例 |
|------|------|----------|
| `POLYMARKET_PRIVATE_KEY` | 用于交易的私钥 | 08, 09, 10, 13 |
| `SCAN_INTERVAL_MS` | 套利扫描间隔（毫秒） | 12, 13 |
| `PROFIT_THRESHOLD` | 最小套利利润百分比 | 11, 12, 13 |

