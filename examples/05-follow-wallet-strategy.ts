/**
 * Example 5: Follow Wallet Strategy
 *
 * This example demonstrates:
 * - Tracking a smart money wallet's positions
 * - Detecting sell activity (for exit signals)
 * - Calculating sell ratio for position exit
 *
 * Run: npx ts-node examples/05-follow-wallet-strategy.ts
 */

import { PolymarketSDK, type Position, type Activity } from '../src/index.js';

interface WalletPositionTracker {
  address: string;
  position: Position;
  entryTimestamp: number;
  peakValue: number;
  cumulativeSellAmount: number;
  sellRatio: number;
}

async function detectSellActivity(
  sdk: PolymarketSDK,
  address: string,
  conditionId: string,
  sinceTimestamp: number
): Promise<{ totalSellAmount: number; sellTransactions: Activity[] }> {
  const activities = await sdk.dataApi.getActivity(address, { limit: 200, type: 'TRADE' });

  const sellTransactions = activities.filter(
    (a) =>
      a.conditionId === conditionId &&
      a.side === 'SELL' &&
      a.timestamp >= sinceTimestamp
  );

  const totalSellAmount = sellTransactions.reduce(
    (sum, a) => sum + (a.usdcSize || a.size * a.price),
    0
  );

  return { totalSellAmount, sellTransactions };
}

async function main() {
  console.log('=== 跟单策略示例 ===\n');

  const sdk = new PolymarketSDK();

  // 1. Get top traders from leaderboard
  console.log('1. 正在从排行榜获取顶级交易者...');
  const leaderboard = await sdk.dataApi.getLeaderboard({ limit: 5 });
  console.log(`   找到 ${leaderboard.entries.length} 个顶级交易者\n`);

  if (leaderboard.entries.length === 0) {
    console.log('未找到排行榜条目');
    return;
  }

  // 2. Select a trader to follow
  const traderToFollow = leaderboard.entries[0];
  console.log(`2. 正在跟踪交易者: ${traderToFollow.address.slice(0, 10)}...`);
  console.log(`   排名: #${traderToFollow.rank}`);
  console.log(`   盈亏: $${traderToFollow.pnl.toLocaleString()}\n`);

  // 3. Get their positions
  console.log('3. 正在获取持仓...');
  const positions = await sdk.dataApi.getPositions(traderToFollow.address);
  console.log(`   找到 ${positions.length} 个持仓\n`);

  if (positions.length === 0) {
    console.log('此交易者未找到持仓');
    return;
  }

  // 4. Analyze each position for sell activity
  console.log('4. 正在分析持仓的卖出活动...\n');

  const trackers: WalletPositionTracker[] = [];
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const position of positions.slice(0, 5)) {
      console.log(`   检查中: ${position.title.slice(0, 50)}...`);

    try {
      // Get sell activity since 1 week ago
      const sellData = await detectSellActivity(
        sdk,
        traderToFollow.address,
        position.conditionId,
        oneWeekAgo
      );

      // Calculate peak value (current value + sells)
      const currentValue = position.currentValue || position.size * (position.curPrice || position.avgPrice);
      const peakValue = currentValue + sellData.totalSellAmount;

      // Calculate sell ratio
      const sellRatio = peakValue > 0 ? sellData.totalSellAmount / peakValue : 0;

      trackers.push({
        address: traderToFollow.address,
        position,
        entryTimestamp: oneWeekAgo, // Approximation
        peakValue,
        cumulativeSellAmount: sellData.totalSellAmount,
        sellRatio,
      });

      console.log(`     当前价值: $${currentValue.toFixed(2)}`);
      console.log(`     累计卖出: $${sellData.totalSellAmount.toFixed(2)}`);
      console.log(`     估算峰值: $${peakValue.toFixed(2)}`);
      console.log(`     卖出比率: ${(sellRatio * 100).toFixed(1)}%`);

      // Check if 30% threshold is reached
      if (sellRatio >= 0.3) {
        console.log(`     ** 退出信号: 卖出比率 >= 30% **`);
      }
      console.log('');

    } catch (error) {
      console.log(`     错误: ${(error as Error).message}\n`);
    }
  }

  // 5. Summary
  console.log('=== 跟单策略总结 ===\n');
  console.log(`交易者: ${traderToFollow.address.slice(0, 10)}...`);
  console.log(`已分析持仓: ${trackers.length}\n`);

  const exitSignals = trackers.filter((t) => t.sellRatio >= 0.3);
  if (exitSignals.length > 0) {
    console.log(`退出信号 (${exitSignals.length}):`);
    for (const signal of exitSignals) {
      console.log(`  - ${signal.position.title.slice(0, 40)}...`);
      console.log(`    卖出比率: ${(signal.sellRatio * 100).toFixed(1)}%`);
    }
  } else {
    console.log('未检测到退出信号');
  }

  const holdingStrong = trackers.filter((t) => t.sellRatio < 0.1);
  if (holdingStrong.length > 0) {
    console.log(`\n强势持有 (卖出比率 < 10%):`);
    for (const hold of holdingStrong) {
      console.log(`  - ${hold.position.title.slice(0, 40)}...`);
      console.log(`    结果: ${hold.position.outcome}`);
      console.log(`    盈亏: $${hold.position.cashPnl?.toFixed(2) || 'N/A'}`);
    }
  }

  console.log('\n=== 完成 ===');
}

main().catch(console.error);
