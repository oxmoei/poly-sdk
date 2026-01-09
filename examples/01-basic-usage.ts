/**
 * Example 1: Basic SDK Usage
 *
 * This example demonstrates:
 * - Getting trending markets from Gamma API
 * - Getting market details from unified API (Gamma + CLOB)
 * - Getting orderbook data
 *
 * Run: npx ts-node examples/01-basic-usage.ts
 */

import { PolymarketSDK } from '../src/index.js';

async function main() {
  console.log('=== Polymarket SDK 基础用法示例 ===\n');

  const sdk = new PolymarketSDK();

  // 1. Get trending markets
  console.log('1. 正在获取热门市场...');
  const trendingMarkets = await sdk.gammaApi.getTrendingMarkets(5);
  console.log(`   找到 ${trendingMarkets.length} 个热门市场:\n`);

  for (const market of trendingMarkets) {
    console.log(`   - ${market.question}`);
    console.log(`     标识: ${market.slug}`);
    console.log(`     总交易量: $${market.volume.toLocaleString()}`);
    console.log(`     24小时交易量: $${market.volume24hr?.toLocaleString() || 'N/A'}`);
    console.log(`     价格: 是=${market.outcomePrices[0]?.toFixed(2)}, 否=${market.outcomePrices[1]?.toFixed(2)}`);
    console.log('');
  }

  // 2. Get unified market details (Gamma + CLOB merged)
  if (trendingMarkets.length > 0) {
    const firstMarket = trendingMarkets[0];
    console.log(`2. 正在获取统一市场详情: ${firstMarket.slug}`);
    const unifiedMarket = await sdk.getMarket(firstMarket.slug);
    console.log(`   问题: ${unifiedMarket.question}`);
    console.log(`   条件 ID: ${unifiedMarket.conditionId}`);
    const yesToken = unifiedMarket.tokens.find(t => t.outcome === 'Yes');
    const noToken = unifiedMarket.tokens.find(t => t.outcome === 'No');
    console.log(`   是 代币 ID: ${yesToken?.tokenId}`);
    console.log(`   否 代币 ID: ${noToken?.tokenId}`);
    console.log(`   是 价格: ${yesToken?.price.toFixed(4)}`);
    console.log(`   否 价格: ${noToken?.price.toFixed(4)}`);
    console.log(`   数据源: ${unifiedMarket.source}`);
    console.log('');

    // 3. Get orderbook
    console.log('3. 正在获取订单簿...');
    const orderbook = await sdk.getOrderbook(unifiedMarket.conditionId);
    console.log(`   是 最佳买价: ${orderbook.yes.bid.toFixed(4)} (数量: ${orderbook.yes.bidSize.toFixed(2)})`);
    console.log(`   是 最佳卖价: ${orderbook.yes.ask.toFixed(4)} (数量: ${orderbook.yes.askSize.toFixed(2)})`);
    console.log(`   是 价差: ${(orderbook.yes.spread * 100).toFixed(2)}%`);
    console.log('');
    console.log(`   否 最佳买价: ${orderbook.no.bid.toFixed(4)} (数量: ${orderbook.no.bidSize.toFixed(2)})`);
    console.log(`   否 最佳卖价: ${orderbook.no.ask.toFixed(4)} (数量: ${orderbook.no.askSize.toFixed(2)})`);
    console.log(`   否 价差: ${(orderbook.no.spread * 100).toFixed(2)}%`);
    console.log('');
    console.log(`   卖单总和 (是+否): ${orderbook.summary.askSum.toFixed(4)}`);
    console.log(`   买单总和 (是+否): ${orderbook.summary.bidSum.toFixed(4)}`);
    console.log(`   多头套利利润: ${(orderbook.summary.longArbProfit * 100).toFixed(3)}%`);
    console.log(`   空头套利利润: ${(orderbook.summary.shortArbProfit * 100).toFixed(3)}%`);
    console.log(`   不平衡比率: ${orderbook.summary.imbalanceRatio.toFixed(2)}`);
  }

  console.log('\n=== 完成 ===');
}

main().catch(console.error);
