/**
 * Example 6: Services Demo
 *
 * This example demonstrates the new service layer:
 * - WalletService for smart money analysis
 * - MarketService for K-Line and market signals
 *
 * Run: npx tsx examples/06-services-demo.ts
 */

import { PolymarketSDK, type KLineInterval } from '../src/index.js';

async function main() {
  console.log('=== 服务演示示例 ===\n');

  const sdk = new PolymarketSDK();

  // ===== WalletService Demo =====
  console.log('--- 钱包服务演示 ---\n');

  // 1. Get top traders
  console.log('1. 正在获取顶级交易者...');
  const topTraders = await sdk.wallets.getTopTraders(5);
  console.log(`   找到 ${topTraders.length} 个顶级交易者\n`);

  for (const trader of topTraders.slice(0, 3)) {
    console.log(`   排名 #${trader.rank}: ${trader.address.slice(0, 10)}...`);
    console.log(`   盈亏: $${trader.pnl.toLocaleString()}`);
    console.log(`   交易量: $${trader.volume.toLocaleString()}\n`);
  }

  // 2. Get wallet profile
  if (topTraders.length > 0) {
    console.log('2. 正在获取顶级交易者的钱包资料...');
    const profile = await sdk.wallets.getWalletProfile(topTraders[0].address);
    console.log(`   地址: ${profile.address.slice(0, 10)}...`);
    console.log(`   总盈亏: $${profile.totalPnL.toFixed(2)}`);
    console.log(`   聪明分数: ${profile.smartScore}/100`);
    console.log(`   持仓数: ${profile.positionCount}`);
    console.log(`   最后活跃: ${profile.lastActiveAt.toLocaleString()}\n`);
  }

  // 3. Discover active wallets
  console.log('3. 正在从最近交易中发现活跃钱包...');
  const activeWallets = await sdk.wallets.discoverActiveWallets(5);
  console.log(`   找到 ${activeWallets.length} 个活跃钱包:\n`);
  for (const wallet of activeWallets) {
    console.log(`   - ${wallet.address.slice(0, 10)}...: ${wallet.tradeCount} 笔交易`);
  }

  // ===== MarketService Demo =====
  console.log('\n--- 市场服务演示 ---\n');

  // 4. Get trending market
  console.log('4. 正在获取热门市场...');
  const trendingMarkets = await sdk.markets.getTrendingMarkets(1);
  if (trendingMarkets.length === 0) {
    console.log('未找到热门市场');
    return;
  }

  const market = trendingMarkets[0];
  console.log(`   市场: ${market.question.slice(0, 60)}...`);
  console.log(`   条件 ID: ${market.conditionId}\n`);

  // 5. Get unified market data
  console.log('5. 正在获取统一市场数据...');
  const unifiedMarket = await sdk.markets.getMarket(market.conditionId);
  console.log(`   数据源: ${unifiedMarket.source}`);
  const yesToken = unifiedMarket.tokens.find(t => t.outcome === 'Yes');
  const noToken = unifiedMarket.tokens.find(t => t.outcome === 'No');
  console.log(`   是 价格: ${yesToken?.price}`);
  console.log(`   否 价格: ${noToken?.price}`);
  console.log(`   24小时交易量: $${unifiedMarket.volume24hr?.toLocaleString() || 'N/A'}\n`);

  // 6. Get K-Lines
  console.log('6. 正在获取 K线数据...');
  const interval: KLineInterval = '1h';
  const klines = await sdk.markets.getKLines(market.conditionId, interval, { limit: 100 });
  console.log(`   生成了 ${klines.length} 根K线 (${interval} 间隔)\n`);

  if (klines.length > 0) {
    console.log('   最近 3 根K线:');
    for (const candle of klines.slice(-3)) {
      const date = new Date(candle.timestamp).toLocaleString();
      console.log(`   [${date}] 开:${candle.open.toFixed(3)} 高:${candle.high.toFixed(3)} 低:${candle.low.toFixed(3)} 收:${candle.close.toFixed(3)} 量:$${candle.volume.toFixed(0)}`);
    }
  }

  // 7. Get Dual K-Lines
  console.log('\n7. 正在获取双K线 (是 + 否)...');
  const dualKlines = await sdk.markets.getDualKLines(market.conditionId, interval, { limit: 100 });
  console.log(`   是 K线: ${dualKlines.yes.length}`);
  console.log(`   否 K线: ${dualKlines.no.length}`);

  if (dualKlines.spreadAnalysis && dualKlines.spreadAnalysis.length > 0) {
    console.log('\n   价差分析 (最近 3 个):');
    for (const point of dualKlines.spreadAnalysis.slice(-3)) {
      const date = new Date(point.timestamp).toLocaleString();
      console.log(`   [${date}] 是:${point.yesPrice.toFixed(3)} + 否:${point.noPrice.toFixed(3)} = ${point.spread.toFixed(4)} ${point.arbOpportunity}`);
    }
  }

  // 8. Detect market signals
  console.log('\n8. 正在检测市场信号...');
  const signals = await sdk.markets.detectMarketSignals(market.conditionId);
  console.log(`   找到 ${signals.length} 个信号:\n`);
  for (const signal of signals.slice(0, 5)) {
    console.log(`   - 类型: ${signal.type}, 严重程度: ${signal.severity}`);
  }

  // 9. Check for arbitrage
  console.log('\n9. 正在检查套利机会...');
  const arb = await sdk.markets.detectArbitrage(market.conditionId, 0.001);
  if (arb) {
    console.log(`   发现套利机会!`);
    console.log(`   类型: ${arb.type}, 利润: ${(arb.profit * 100).toFixed(3)}%`);
    console.log(`   操作: ${arb.action}`);
  } else {
    console.log('   未找到套利机会');
  }

  console.log('\n=== 完成 ===');
}

main().catch(console.error);
