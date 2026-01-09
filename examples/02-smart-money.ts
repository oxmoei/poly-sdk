/**
 * Example 2: Smart Money Analysis
 *
 * This example demonstrates:
 * - Getting wallet positions
 * - Getting wallet activity (trades)
 * - Getting leaderboard data
 * - Discovering active wallets from recent trades
 *
 * Run: npx ts-node examples/02-smart-money.ts
 */

import { PolymarketSDK } from '../src/index.js';

async function main() {
  console.log('=== 聪明钱分析示例 ===\n');

  const sdk = new PolymarketSDK();

  // 1. Get leaderboard
  console.log('1. 正在获取排行榜（前 10 名）...');
  let leaderboard;
  try {
    leaderboard = await sdk.dataApi.getLeaderboard({ limit: 10 });
  } catch (error: any) {
    if (error.code === 'ETIMEDOUT' || error.message?.includes('fetch failed')) {
      console.error('❌ 网络连接超时，请检查：');
      console.error('   - 网络连接是否正常');
      console.error('   - 是否需要使用代理');
      console.error('   - API 服务器是否可访问');
      console.error('\n错误详情:', error.message);
      process.exit(1);
    }
    throw error;
  }
  console.log(`   总条目数: ${leaderboard.total}`);
  console.log('   前 10 名交易者:\n');

  for (const entry of leaderboard.entries.slice(0, 10)) {
    console.log(`   #${entry.rank} ${entry.address}`);
    console.log(`       盈亏: $${entry.pnl.toLocaleString()}`);
    console.log(`       交易量: $${entry.volume.toLocaleString()}`);
    console.log(`       持仓数: ${entry.positions}, 交易次数: ${entry.trades}`);
  }

  // 2. Get wallet positions for top trader
  if (leaderboard.entries.length > 0) {
    const topTrader = leaderboard.entries[0].address;
    console.log(`\n2. 正在获取顶级交易者的持仓: ${topTrader}`);

    let positions;
    try {
      positions = await sdk.dataApi.getPositions(topTrader);
    } catch (error: any) {
      if (error.code === 'ETIMEDOUT' || error.message?.includes('fetch failed')) {
        console.error('❌ 获取持仓数据时网络超时，跳过此步骤\n');
        positions = [];
      } else {
        throw error;
      }
    }
    console.log(`   找到 ${positions.length} 个持仓:\n`);

    for (const pos of positions.slice(0, 5)) {
      console.log(`   - ${pos.title || '未知市场'}`);
      console.log(`     结果: ${pos.outcome}`);
      console.log(`     数量: ${pos.size.toFixed(2)}`);
      console.log(`     平均价格: ${pos.avgPrice.toFixed(4)}`);
      console.log(`     当前价格: ${pos.curPrice?.toFixed(4) || 'N/A'}`);
      console.log(`     盈亏: $${pos.cashPnl?.toFixed(2) || 'N/A'} (${pos.percentPnl?.toFixed(1) || 'N/A'}%)`);
      console.log('');
    }

    // 3. Get recent activity for top trader
    console.log(`3. 正在获取顶级交易者的最近活动...`);
    let activity;
    try {
      activity = await sdk.dataApi.getActivity(topTrader, { limit: 10 });
    } catch (error: any) {
      if (error.code === 'ETIMEDOUT' || error.message?.includes('fetch failed')) {
        console.error('❌ 获取活动数据时网络超时，跳过此步骤\n');
        activity = [];
      } else {
        throw error;
      }
    }
    console.log(`   找到 ${activity.length} 个最近活动:\n`);

    for (const act of activity.slice(0, 5)) {
      const date = new Date(act.timestamp).toLocaleString();
      console.log(`   - [${date}] ${act.type} ${act.side}`);
      console.log(`     数量: ${act.size.toFixed(2)} @ ${act.price.toFixed(4)}`);
      console.log(`     价值: $${(act.usdcSize || 0).toFixed(2)}`);
      console.log(`     结果: ${act.outcome}`);
      console.log('');
    }
  }

  // 4. Discover active wallets from recent trades
  console.log('4. 正在从最近交易中发现活跃钱包...');
  let recentTrades;
  try {
    recentTrades = await sdk.dataApi.getTrades({ limit: 100 });
  } catch (error: any) {
    if (error.code === 'ETIMEDOUT' || error.message?.includes('fetch failed')) {
      console.error('❌ 获取交易数据时网络超时');
      console.error('   跳过此步骤，继续执行...\n');
      recentTrades = [];
    } else {
      throw error;
    }
  }
  console.log(`   获取了 ${recentTrades.length} 个最近交易`);

  // Count trades per wallet
  const walletCounts = new Map<string, number>();
  for (const trade of recentTrades) {
    if (trade.proxyWallet) {
      walletCounts.set(
        trade.proxyWallet,
        (walletCounts.get(trade.proxyWallet) || 0) + 1
      );
    }
  }

  // Sort by count
  const sortedWallets = [...walletCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  console.log('   最近交易中最活跃的钱包:\n');
  for (const [wallet, count] of sortedWallets) {
    console.log(`   - ${wallet}: ${count} 笔交易`);
  }

  console.log('\n=== 完成 ===');
}

main().catch((error) => {
  if (error.code === 'ETIMEDOUT' || error.message?.includes('fetch failed')) {
    console.error('\n❌ 网络连接错误');
    console.error('可能的原因：');
    console.error('  1. 网络连接不稳定');
    console.error('  2. API 服务器响应慢');
    console.error('  3. 防火墙或代理设置问题');
    console.error('  4. 服务器临时不可用');
    console.error('\n建议：');
    console.error('  - 检查网络连接');
    console.error('  - 稍后重试');
    console.error('  - 如果使用代理，请检查代理设置');
    process.exit(1);
  } else {
    console.error('错误:', error);
    process.exit(1);
  }
});
