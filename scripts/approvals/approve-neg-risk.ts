#!/usr/bin/env npx tsx
/**
 * Simple script to approve Neg Risk Adapter
 */

import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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
  console.error('未找到 POLYMARKET_PRIVATE_KEY');
  process.exit(1);
}

const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const NEG_RISK_ADAPTER = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

async function main() {
  console.log('正在授权 Neg Risk Adapter...');

  // Try multiple RPCs
  const rpcs = [
    'https://polygon-bor-rpc.publicnode.com',
    'https://polygon.drpc.org',
    'https://polygon-rpc.com',
  ];

  for (const rpc of rpcs) {
    console.log(`\n尝试 RPC: ${rpc}`);
    try {
      const provider = new ethers.providers.JsonRpcProvider({
        url: rpc,
        timeout: 30000,
      });

      // Test connection
      const network = await provider.getNetwork();
      console.log(`已连接到链 ${network.chainId}`);

      const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
      console.log(`钱包: ${wallet.address}`);

      const usdc = new ethers.Contract(USDC_E, ERC20_ABI, wallet);

      // Check current allowance
      const currentAllowance = await usdc.allowance(wallet.address, NEG_RISK_ADAPTER);
      console.log(`当前授权: ${ethers.utils.formatUnits(currentAllowance, 6)} USDC`);

      if (currentAllowance.gt(ethers.utils.parseUnits('1000000000', 6))) {
        console.log('✅ 已授权!');
        return;
      }

      // Get gas price
      const gasPrice = await provider.getGasPrice();
      const adjustedGas = gasPrice.mul(2); // 2x for safety
      console.log(`Gas 价格: ${ethers.utils.formatUnits(adjustedGas, 'gwei')} Gwei`);

      // Approve
      console.log('正在发送授权交易...');
      const tx = await usdc.approve(NEG_RISK_ADAPTER, ethers.constants.MaxUint256, {
        gasPrice: adjustedGas,
        gasLimit: 100000,
      });

      console.log(`交易哈希: ${tx.hash}`);
      console.log('等待确认...');

      const receipt = await tx.wait();
      console.log(`✅ 已在区块 ${receipt.blockNumber} 确认`);

      // Verify
      const newAllowance = await usdc.allowance(wallet.address, NEG_RISK_ADAPTER);
      console.log(`新授权: 无限`);

      return;
    } catch (error: any) {
      console.log(`失败: ${error.message}`);
    }
  }

  console.log('\n❌ 所有 RPC 都失败了!');
  console.log('请在 Polygonscan 上手动授权:');
  console.log('https://polygonscan.com/token/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174#writeContract');
}

main().catch(console.error);
