/**
 * Example 4: K-Line Aggregation from Trade Data
 *
 * This example demonstrates:
 * - Getting trade history for a market
 * - Aggregating trades into K-Line (OHLCV) candles
 * - Calculating dual-token K-Lines (YES + NO)
 *
 * Run: npx ts-node examples/04-kline-aggregation.ts
 */

import { PolymarketSDK, type Trade, type KLineInterval, getIntervalMs } from '../src/index.js';

interface KLineCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount: number;
  buyVolume: number;
  sellVolume: number;
}

function aggregateToKLines(trades: Trade[], interval: KLineInterval): KLineCandle[] {
  const intervalMs = getIntervalMs(interval);
  const buckets = new Map<number, Trade[]>();

  // Group trades into time buckets
  for (const trade of trades) {
    const bucketTime = Math.floor(trade.timestamp / intervalMs) * intervalMs;
    const bucket = buckets.get(bucketTime) || [];
    bucket.push(trade);
    buckets.set(bucketTime, bucket);
  }

  // Convert buckets to candles
  const candles: KLineCandle[] = [];
  for (const [timestamp, bucketTrades] of buckets) {
    if (bucketTrades.length === 0) continue;

    // Sort by timestamp for correct open/close
    bucketTrades.sort((a, b) => a.timestamp - b.timestamp);

    const prices = bucketTrades.map((t) => t.price);
    const buyTrades = bucketTrades.filter((t) => t.side === 'BUY');
    const sellTrades = bucketTrades.filter((t) => t.side === 'SELL');

    candles.push({
      timestamp,
      open: bucketTrades[0].price,
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: bucketTrades[bucketTrades.length - 1].price,
      volume: bucketTrades.reduce((sum, t) => sum + t.size * t.price, 0),
      tradeCount: bucketTrades.length,
      buyVolume: buyTrades.reduce((sum, t) => sum + t.size * t.price, 0),
      sellVolume: sellTrades.reduce((sum, t) => sum + t.size * t.price, 0),
    });
  }

  return candles.sort((a, b) => a.timestamp - b.timestamp);
}

async function main() {
  console.log('=== K线聚合示例（从交易数据） ===\n');

  const sdk = new PolymarketSDK();

  // 1. Get a trending market
  console.log('1. 正在获取热门市场...');
  const markets = await sdk.gammaApi.getTrendingMarkets(1);

  if (markets.length === 0) {
    console.log('未找到热门市场');
    return;
  }

  const market = markets[0];
  console.log(`   已选择: ${market.question}`);
  console.log(`   条件 ID: ${market.conditionId}\n`);

  // 2. Get trade history
  console.log('2. 正在获取交易历史...');
  const trades = await sdk.dataApi.getTradesByMarket(market.conditionId, 500);
  console.log(`   找到 ${trades.length} 笔交易\n`);

  if (trades.length === 0) {
    console.log('此市场未找到交易');
    return;
  }

  // 3. Get token info
  console.log('3. 正在获取代币信息...');
  const unifiedMarket = await sdk.getMarket(market.conditionId);
  const yesToken = unifiedMarket.tokens.find(t => t.outcome === 'Yes');
  const noToken = unifiedMarket.tokens.find(t => t.outcome === 'No');
  console.log(`   是 代币: ${yesToken?.tokenId.slice(0, 16)}...`);
  console.log(`   否 代币: ${noToken?.tokenId.slice(0, 16)}...\n`);

  // 4. Separate trades by token (YES vs NO)
  const yesTrades = trades.filter((t) => t.outcomeIndex === 0 || t.outcome === 'Yes');
  const noTrades = trades.filter((t) => t.outcomeIndex === 1 || t.outcome === 'No');
  console.log(`4. 已分离交易: 是=${yesTrades.length}, 否=${noTrades.length}\n`);

  // 5. Aggregate into 1-hour candles
  const interval: KLineInterval = '1h';
  console.log(`5. 正在聚合为 ${interval} K线...\n`);

  const yesCandles = aggregateToKLines(yesTrades, interval);
  const noCandles = aggregateToKLines(noTrades, interval);

  console.log(`   是 代币 K线 (${yesCandles.length} 根):`);
  for (const candle of yesCandles.slice(-5)) {
    const date = new Date(candle.timestamp).toLocaleString();
    console.log(
      `   [${date}] 开:${candle.open.toFixed(3)} 高:${candle.high.toFixed(3)} 低:${candle.low.toFixed(3)} 收:${candle.close.toFixed(3)} 量:$${candle.volume.toFixed(0)} (${candle.tradeCount} 笔交易)`
    );
  }

  console.log(`\n   否 代币 K线 (${noCandles.length} 根):`);
  for (const candle of noCandles.slice(-5)) {
    const date = new Date(candle.timestamp).toLocaleString();
    console.log(
      `   [${date}] 开:${candle.open.toFixed(3)} 高:${candle.high.toFixed(3)} 低:${candle.low.toFixed(3)} 收:${candle.close.toFixed(3)} 量:$${candle.volume.toFixed(0)} (${candle.tradeCount} 笔交易)`
    );
  }

  // 6. Calculate spread over time
  console.log('\n6. 价差分析 (是价格 + 否价格):\n');

  // Find matching timestamps
  const yesMap = new Map(yesCandles.map((c) => [c.timestamp, c]));
  const noMap = new Map(noCandles.map((c) => [c.timestamp, c]));

  const allTimestamps = [...new Set([...yesMap.keys(), ...noMap.keys()])].sort();
  let lastYes = 0.5;
  let lastNo = 0.5;

  for (const ts of allTimestamps.slice(-5)) {
    const date = new Date(ts).toLocaleString();
    const yesCandle = yesMap.get(ts);
    const noCandle = noMap.get(ts);

    if (yesCandle) lastYes = yesCandle.close;
    if (noCandle) lastNo = noCandle.close;

    const spread = lastYes + lastNo;
    const arbOpportunity = spread < 1 ? '多头套利' : spread > 1 ? '空头套利' : '';

    console.log(
      `   [${date}] 是:${lastYes.toFixed(3)} + 否:${lastNo.toFixed(3)} = ${spread.toFixed(4)} ${arbOpportunity}`
    );
  }

  console.log('\n=== 完成 ===');
}

main().catch(console.error);
