/**
 * Example 3: Market Analysis & Arbitrage Detection
 *
 * This example demonstrates:
 * - Getting multiple markets' orderbooks
 * - Detecting arbitrage opportunities
 * - Analyzing market depth and imbalance
 *
 * Run: npx ts-node examples/03-market-analysis.ts
 */

import { PolymarketSDK } from '../src/index.js';

async function main() {
  console.log('=== 市场分析与套利检测示例 ===\n');

  const sdk = new PolymarketSDK();

  // 1. Get trending markets for analysis
  console.log('1. 正在获取热门市场...');
  const markets = await sdk.gammaApi.getTrendingMarkets(10);
  console.log(`   找到 ${markets.length} 个热门市场\n`);

  // 2. Analyze each market for arbitrage
  console.log('2. 正在分析市场套利机会...\n');

  const arbitrageOpportunities = [];

  for (const market of markets) {
    try {
      console.log(`   检查中: ${market.question.slice(0, 60)}...`);

      // Get unified market for token IDs
      const unifiedMarket = await sdk.getMarket(market.conditionId);

      const yesToken = unifiedMarket.tokens.find(t => t.outcome === 'Yes');
      const noToken = unifiedMarket.tokens.find(t => t.outcome === 'No');
      if (!yesToken?.tokenId || !noToken?.tokenId) {
        console.log('     跳过（缺少代币 ID）\n');
        continue;
      }

      // Get orderbook
      const orderbook = await sdk.getOrderbook(market.conditionId);

      // Check for arbitrage
      const arb = await sdk.detectArbitrage(market.conditionId, 0.001); // 0.1% threshold

      if (arb) {
        console.log(`     ** 发现套利机会 **`);
        console.log(`     类型: ${arb.type}`);
        console.log(`     利润: ${(arb.profit * 100).toFixed(3)}%`);
        console.log(`     操作: ${arb.action}`);
        arbitrageOpportunities.push({
          market: market.question,
          slug: market.slug,
          ...arb,
        });
      } else {
        console.log(`     无套利机会 (卖单总和: ${orderbook.summary.askSum.toFixed(4)}, 买单总和: ${orderbook.summary.bidSum.toFixed(4)})`);
      }
      console.log('');

    } catch (error) {
      console.log(`     错误: ${(error as Error).message}\n`);
    }
  }

  // 3. Summary
  console.log('=== 总结 ===\n');

  if (arbitrageOpportunities.length > 0) {
    console.log(`找到 ${arbitrageOpportunities.length} 个套利机会:\n`);
    for (const opp of arbitrageOpportunities) {
      console.log(`- ${opp.market.slice(0, 60)}...`);
      console.log(`  标识: ${opp.slug}`);
      console.log(`  类型: ${opp.type}, 利润: ${(opp.profit * 100).toFixed(3)}%`);
      console.log('');
    }
  } else {
    console.log('未找到套利机会（这在高效市场中是正常的）');
  }

  // 4. Analyze market depth
  console.log('\n=== 市场深度分析 ===\n');

  for (const market of markets.slice(0, 3)) {
    try {
      const orderbook = await sdk.getOrderbook(market.conditionId);

      console.log(`市场: ${market.question.slice(0, 50)}...`);
      console.log(`  总买单深度: $${orderbook.summary.totalBidDepth.toFixed(2)}`);
      console.log(`  总卖单深度: $${orderbook.summary.totalAskDepth.toFixed(2)}`);
      console.log(`  不平衡比率: ${orderbook.summary.imbalanceRatio.toFixed(2)}`);

      if (orderbook.summary.imbalanceRatio > 1.5) {
        console.log(`  ** 高买压 (比率 > 1.5) **`);
      } else if (orderbook.summary.imbalanceRatio < 0.67) {
        console.log(`  ** 高卖压 (比率 < 0.67) **`);
      }
      console.log('');
    } catch {
      // Skip errors
    }
  }

  console.log('=== 完成 ===');
}

main().catch(console.error);
