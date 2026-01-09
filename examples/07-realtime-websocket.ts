/**
 * Example 7: Real-time WebSocket
 *
 * This example demonstrates real-time price updates using RealtimeServiceV2:
 * - Connection management
 * - Market data subscriptions (orderbook, prices, trades)
 * - Crypto price subscriptions (BTC, ETH)
 *
 * Run: npx tsx examples/07-realtime-websocket.ts
 */

import { PolymarketSDK, RealtimeServiceV2 } from '../src/index.js';

async function main() {
  console.log('=== 实时 WebSocket 演示 (V2) ===\n');

  const sdk = new PolymarketSDK();

  // 1. Get a trending market to subscribe to
  console.log('1. 正在获取热门市场...');
  const trendingMarkets = await sdk.markets.getTrendingMarkets(1);
  if (trendingMarkets.length === 0) {
    console.log('未找到热门市场');
    return;
  }

  const market = trendingMarkets[0];
  console.log(`   市场: ${market.question.slice(0, 60)}...`);
  console.log(`   条件 ID: ${market.conditionId}\n`);

  // 2. Get market details for token IDs
  console.log('2. 正在获取市场详情...');
  const unifiedMarket = await sdk.markets.getMarket(market.conditionId);
  const yesToken = unifiedMarket.tokens.find(t => t.outcome === 'Yes');
  const noToken = unifiedMarket.tokens.find(t => t.outcome === 'No');
  const yesTokenId = yesToken?.tokenId || '';
  const noTokenId = noToken?.tokenId || '';
  console.log(`   是 代币: ${yesTokenId.slice(0, 20)}...`);
  console.log(`   否 代币: ${noTokenId.slice(0, 20)}...`);
  console.log(`   当前是 价格: ${yesToken?.price}`);
  console.log(`   当前否 价格: ${noToken?.price}\n`);

  if (!yesTokenId || !noTokenId) {
    console.log('此市场无可用代币 ID');
    return;
  }

  // 3. Create RealtimeServiceV2 and connect
  console.log('3. 正在连接到 WebSocket...');
  const realtime = new RealtimeServiceV2({ debug: false });

  // Wait for connection
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('连接超时')), 10000);

    realtime.once('connected', () => {
      clearTimeout(timeout);
      console.log('   已连接!\n');
      resolve();
    });

    realtime.connect();
  });

  // 4. Subscribe to market data
  console.log('4. 正在订阅市场更新...');
  let updateCount = 0;
  const maxUpdates = 10;

  const subscription = realtime.subscribeMarket(yesTokenId, noTokenId, {
    onOrderbook: (book) => {
      updateCount++;
      const side = book.assetId === yesTokenId ? '是' : '否';
      const bestBid = book.bids[0];
      const bestAsk = book.asks[0];
      console.log(`   [${new Date().toLocaleTimeString()}] ${side} 订单簿: 买 ${bestBid?.price.toFixed(4)} (${bestBid?.size.toFixed(0)}) | 卖 ${bestAsk?.price.toFixed(4)} (${bestAsk?.size.toFixed(0)})`);
    },
    onPriceUpdate: (update) => {
      const side = update.assetId === yesTokenId ? '是' : '否';
      console.log(`   [${new Date().toLocaleTimeString()}] ${side} 价格: ${update.price.toFixed(4)} (中间价: ${update.midpoint.toFixed(4)}, 价差: ${update.spread.toFixed(4)})`);
    },
    onLastTrade: (trade) => {
      const side = trade.assetId === yesTokenId ? '是' : '否';
      console.log(`   [${new Date().toLocaleTimeString()}] ${side} 交易: ${trade.side} ${trade.size} @ ${trade.price.toFixed(4)}`);
    },
    onPairUpdate: (update) => {
      const spread = update.spread;
      const arbSignal = spread < 0.99 ? '套利!' : spread > 1.01 ? '套利!' : '正常';
      console.log(`   [${new Date().toLocaleTimeString()}] 配对: 是 ${update.yes.price.toFixed(4)} + 否 ${update.no.price.toFixed(4)} = ${spread.toFixed(4)} [${arbSignal}]`);
    },
    onError: (error) => {
      console.error(`   错误: ${error.message}`);
    },
  });

  console.log(`   订阅 ID: ${subscription.id}`);
  console.log(`   已订阅: ${subscription.tokenIds.length} 个代币`);
  console.log(`\n   等待更新 (最多 ${maxUpdates} 个)...\n`);

  // 5. Optionally subscribe to crypto prices (BTC, ETH)
  console.log('5. 正在订阅加密货币价格...');
  const cryptoSub = realtime.subscribeCryptoPrices(['BTCUSDT', 'ETHUSDT'], {
    onPrice: (price) => {
      console.log(`   [${new Date().toLocaleTimeString()}] ${price.symbol}: $${price.price.toFixed(2)}`);
    },
  });
  console.log(`   加密货币订阅 ID: ${cryptoSub.id}\n`);

  // 6. Wait for some updates
  await new Promise<void>((resolve) => {
    const interval = setInterval(() => {
      if (updateCount >= maxUpdates) {
        clearInterval(interval);
        resolve();
      }
    }, 500);

    // Timeout after 30 seconds
    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, 30000);
  });

  // 7. Check cached prices
  console.log('\n6. 缓存价格:');
  const prices = realtime.getAllPrices();
  for (const [assetId, price] of prices) {
    const side = assetId === yesTokenId ? '是' : '否';
    console.log(`   ${side}: ${price.price.toFixed(4)}`);
  }

  // 8. Cleanup
  console.log('\n7. 正在清理...');
  subscription.unsubscribe();
  cryptoSub.unsubscribe();
  realtime.disconnect();
  console.log('   已断开连接');

  console.log('\n=== 完成 ===');
}

main().catch(console.error);
