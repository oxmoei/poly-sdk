/**
 * Check Wallet Balances Script
 *
 * Query token balances for any wallet address on Polygon.
 * No private key required - just provide an address.
 *
 * Usage:
 *   npx tsx scripts/check-wallet-balances.ts <address>
 *   npx tsx scripts/check-wallet-balances.ts 0xc2e7800b5af46e6093872b177b7a5e7f0563be51
 */

import { SwapService, POLYGON_TOKENS } from '../src/index.js';

const TEST_ADDRESS = '0xc2e7800b5af46e6093872b177b7a5e7f0563be51'; // Top Polymarket trader

async function main() {
  const address = process.argv[2] || TEST_ADDRESS;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║               Polygon 钱包余额检查器                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`钱包: ${address}`);
  console.log('');

  console.log('正在获取余额...');
  console.log('');

  try {
    const balances = await SwapService.getWalletBalances(address);

    console.log('─── 代币余额 ───');
    console.log('');

    for (const b of balances) {
      const amount = parseFloat(b.balance);
      if (amount > 0) {
        console.log(`  ${b.symbol.padEnd(10)} ${b.balance}`);
      }
    }

    // Show zero balances
    const zeroBalances = balances.filter((b) => parseFloat(b.balance) === 0);
    if (zeroBalances.length > 0) {
      console.log('');
      console.log(`  (零余额: ${zeroBalances.map((b) => b.symbol).join(', ')})`);
    }

    // Summary
    console.log('');
    console.log('─── 摘要 ───');
    const nonZero = balances.filter((b) => parseFloat(b.balance) > 0);
    console.log(`  有余额的代币: ${nonZero.length}`);

    // Calculate stablecoin value
    let stablecoinValue = 0;
    for (const b of balances) {
      if (['USDC', 'USDC_E', 'USDT', 'DAI'].includes(b.token)) {
        stablecoinValue += parseFloat(b.balance);
      }
    }
    console.log(`  稳定币价值: $${stablecoinValue.toFixed(2)}`);

    console.log('');
    console.log('─── 支持的代币 ───');
    console.log(`  ${Object.keys(POLYGON_TOKENS).join(', ')}`);

  } catch (err) {
    console.error(`错误: ${err instanceof Error ? err.message : err}`);
  }

  console.log('');
}

main().catch(console.error);
