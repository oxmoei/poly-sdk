#!/usr/bin/env npx tsx
/**
 * Test: DipArbService - Scan for ETH 15m markets
 */

import { PolymarketSDK } from '../../src/index.js';

async function main() {
  console.log('=== DipArbService 市场扫描测试 ===\n');

  // Initialize SDK (no private key needed for scanning)
  console.log('正在初始化 SDK...');
  const sdk = new PolymarketSDK();
  console.log('SDK 已初始化\n');

  // Test 1: Scan for ETH 15m markets
  console.log('--- 测试 1: 扫描 ETH 15 分钟市场 ---');
  const ethMarkets = await sdk.dipArb.scanUpcomingMarkets({
    coin: 'ETH',
    duration: '15m',
    minMinutesUntilEnd: 5,
    maxMinutesUntilEnd: 60,
    limit: 5,
  });

  console.log(`找到 ${ethMarkets.length} 个 ETH 15 分钟市场:\n`);

  if (ethMarkets.length === 0) {
    console.log('未找到 ETH 15 分钟市场。如果没有活跃市场，这是正常的。\n');
  } else {
    ethMarkets.forEach((m, i) => {
      const minutesLeft = Math.round((m.endTime.getTime() - Date.now()) / 60000);
      console.log(`${i + 1}. ${m.name}`);
      console.log(`   标识: ${m.slug}`);
      console.log(`   条件 ID: ${m.conditionId}`);
      console.log(`   上涨代币: ${m.upTokenId}`);
      console.log(`   下跌代币: ${m.downTokenId}`);
      console.log(`   标的资产: ${m.underlying}`);
      console.log(`   持续时间: ${m.durationMinutes} 分钟`);
      console.log(`   剩余时间: ${minutesLeft} 分钟`);
      console.log(`   结束时间: ${m.endTime.toLocaleString()}`);
      console.log();
    });
  }

  // Test 2: Scan for all coin types
  console.log('--- 测试 2: 扫描所有币种 15 分钟市场 ---');
  const allMarkets = await sdk.dipArb.scanUpcomingMarkets({
    coin: 'all',
    duration: '15m',
    minMinutesUntilEnd: 5,
    maxMinutesUntilEnd: 60,
    limit: 10,
  });

  console.log(`总共找到 ${allMarkets.length} 个 15 分钟市场:\n`);

  const byUnderlying: Record<string, number> = {};
  allMarkets.forEach(m => {
    byUnderlying[m.underlying] = (byUnderlying[m.underlying] || 0) + 1;
  });

  console.log('按标的资产分类:');
  Object.entries(byUnderlying).forEach(([coin, count]) => {
    console.log(`  ${coin}: ${count} 个市场`);
  });
  console.log();

  // Test 3: Try findAndStart (without actually starting)
  console.log('--- 测试 3: 查找最佳 ETH 市场 ---');

  // We'll use scanUpcomingMarkets to simulate what findAndStart would select
  const bestEthMarket = ethMarkets[0];
  if (bestEthMarket) {
    console.log(`最佳 ETH 市场: ${bestEthMarket.slug}`);
    console.log(`  剩余时间: ${Math.round((bestEthMarket.endTime.getTime() - Date.now()) / 60000)} 分钟`);
  } else {
    console.log('没有可用的 ETH 市场');
  }

  console.log('\n=== 扫描测试完成 ===');
}

main().catch(console.error);
