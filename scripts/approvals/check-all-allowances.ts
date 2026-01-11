#!/usr/bin/env npx tsx
/**
 * Check all Polymarket contract allowances
 */

import { config } from 'dotenv';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load .env from package root
config({ path: path.resolve(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read private key from environment or dashboard-api .env (backward compatibility)
let PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY || process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  try {
    const envPath = path.resolve(__dirname, '../../earning-engine/dashboard-api/.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^PRIVATE_KEY=(.+)$/m);
    PRIVATE_KEY = match ? match[1].trim() : '';
  } catch {
    // File doesn't exist, ignore
  }
}

if (!PRIVATE_KEY) {
  console.error('错误: 未在环境变量或 .env 文件中找到 POLYMARKET_PRIVATE_KEY');
  process.exit(1);
}

// Contract addresses on Polygon
const USDC_E_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';
const NEG_RISK_ADAPTER = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296';

// Additional contracts that might need approval
const CONDITIONAL_TOKENS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          Polymarket 授权检查器 (所有合约)                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Use multiple RPC providers for reliability
  const rpcUrls = [
    'https://polygon-mainnet.g.alchemy.com/v2/demo',
    'https://polygon.llamarpc.com',
    'https://polygon-rpc.com',
  ];

  let provider: ethers.providers.JsonRpcProvider | null = null;
  for (const rpcUrl of rpcUrls) {
    try {
      const p = new ethers.providers.JsonRpcProvider(rpcUrl);
      await p.getNetwork(); // Test connection
      provider = p;
      console.log(`使用 RPC: ${rpcUrl}`);
      break;
    } catch (e) {
      console.log(`RPC 失败: ${rpcUrl}`);
    }
  }

  if (!provider) {
    console.error('所有 RPC 提供商都失败了!');
    process.exit(1);
  }
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const address = wallet.address;
  const usdc = new ethers.Contract(USDC_E_ADDRESS, ERC20_ABI, wallet);

  console.log(`钱包: ${address}`);
  console.log('');

  // Check USDC balance
  const balance = await usdc.balanceOf(address);
  console.log(`USDC.e 余额: ${(parseFloat(balance.toString()) / 1e6).toFixed(6)} USDC`);
  console.log('');

  // Check all allowances
  console.log('─── 合约授权 ───');

  const contracts = [
    { name: 'CTF Exchange', address: CTF_EXCHANGE },
    { name: 'Neg Risk CTF Exchange', address: NEG_RISK_CTF_EXCHANGE },
    { name: 'Neg Risk Adapter', address: NEG_RISK_ADAPTER },
    { name: 'Conditional Tokens', address: CONDITIONAL_TOKENS },
  ];

  let needsApproval = [];

  for (const contract of contracts) {
    const allowance = await usdc.allowance(address, contract.address);
    const allowanceNum = parseFloat(allowance.toString()) / 1e6;
    const isUnlimited = allowanceNum > 1e12;
    const status = isUnlimited ? '✅ Unlimited' : allowanceNum > 0 ? `⚠️ ${allowanceNum.toFixed(2)}` : '❌ None';
    console.log(`${contract.name}: ${status}`);
    if (!isUnlimited) {
      needsApproval.push(contract);
    }
  }

  console.log('');

  if (needsApproval.length > 0) {
    console.log('─── 需要授权 ───');
    console.log('以下合约需要无限授权:');
    for (const contract of needsApproval) {
      console.log(`  - ${contract.name} (${contract.address})`);
    }
    console.log('');
    console.log('使用 --approve 参数来授权所有合约:');
    console.log('  npx tsx scripts/check-all-allowances.ts --approve');
    console.log('');

    if (process.argv.includes('--approve')) {
      console.log('─── 正在授权合约 ───');
      const MAX_UINT256 = ethers.constants.MaxUint256;

      // Get current gas price and add buffer for Polygon
      const gasPrice = await provider.getGasPrice();
      const adjustedGasPrice = gasPrice.mul(150).div(100); // 1.5x current gas price
      console.log(`使用 Gas 价格: ${(adjustedGasPrice.toNumber() / 1e9).toFixed(2)} Gwei`);

      for (const contract of needsApproval) {
        console.log(`正在授权 ${contract.name}...`);
        try {
          const tx = await usdc.approve(contract.address, MAX_UINT256, { gasPrice: adjustedGasPrice });
          console.log(`  交易: ${tx.hash}`);
          await tx.wait();
          console.log(`  ✓ 已授权`);
        } catch (error: any) {
          console.log(`  ✗ 失败: ${error.message}`);
        }
      }
      console.log('');
      console.log('✅ 完成! 请重新运行（不带 --approve）以验证。');
    }
  } else {
    console.log('✅ 所有合约都已获得无限授权!');
    console.log('');
    console.log('如果订单仍然失败，可能的原因:');
    console.log('1. Polymarket 需要通过其 UI 进行充值以创建交易账户');
    console.log('2. 或者 API 密钥可能存在其他问题');
  }
}

main().catch(console.error);
