/**
 * Check and Set CTF Token Approvals for Polymarket Trading
 *
 * The CLOB Exchange requires approval for CTF tokens (ERC1155) in addition to USDC.e.
 * Without CTF token approval, orders fail with "not enough balance / allowance".
 *
 * Usage:
 *   POLYMARKET_PRIVATE_KEY=0x... npx tsx scripts/check-ctf-approval.ts
 *   POLYMARKET_PRIVATE_KEY=0x... npx tsx scripts/check-ctf-approval.ts approve
 */

import { config } from 'dotenv';
import path from 'path';
import { ethers } from 'ethers';

// Load .env from package root
config({ path: path.resolve(process.cwd(), '.env') });

const PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY || process.env.POLY_PRIVKEY || '';
const RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/demo';

// Contracts
const USDC_E_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';
const CTF_TOKEN = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';  // Conditional Tokens (ERC1155)

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

const ERC1155_ABI = [
  'function isApprovedForAll(address account, address operator) view returns (bool)',
  'function setApprovalForAll(address operator, bool approved)',
];

async function main() {
  if (!PRIVATE_KEY) {
    console.error('错误: 请设置 POLYMARKET_PRIVATE_KEY 环境变量');
    process.exit(1);
  }

  const command = process.argv[2] || 'check';

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          Polymarket CTF 授权检查器                               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const address = wallet.address;

  console.log('钱包:', address);
  console.log('');

  // Check USDC.e
  const usdc = new ethers.Contract(USDC_E_ADDRESS, ERC20_ABI, provider);
  const balance = await usdc.balanceOf(address);
  const ctfUsdcAllowance = await usdc.allowance(address, CTF_EXCHANGE);
  const negRiskUsdcAllowance = await usdc.allowance(address, NEG_RISK_CTF_EXCHANGE);

  console.log('─── USDC.e (抵押品) ───');
  const balanceUsdc = parseFloat(ethers.utils.formatUnits(balance, 6));
  console.log('余额:                ' + balanceUsdc.toFixed(6) + ' USDC');
  console.log('CTF 交易所授权:      ' + (ctfUsdcAllowance.gte(ethers.constants.MaxUint256.div(2)) ? '无限 ✅' : ethers.utils.formatUnits(ctfUsdcAllowance, 6) + ' USDC'));
  console.log('Neg Risk CTF 授权:   ' + (negRiskUsdcAllowance.gte(ethers.constants.MaxUint256.div(2)) ? '无限 ✅' : ethers.utils.formatUnits(negRiskUsdcAllowance, 6) + ' USDC'));
  console.log('');

  // Check CTF Token (ERC1155) approvals - THIS IS THE KEY!
  const ctfToken = new ethers.Contract(CTF_TOKEN, ERC1155_ABI, provider);
  const ctfApproved = await ctfToken.isApprovedForAll(address, CTF_EXCHANGE);
  const negRiskApproved = await ctfToken.isApprovedForAll(address, NEG_RISK_CTF_EXCHANGE);

  console.log('─── CTF 代币 (ERC1155 仓位代币) ───');
  console.log('CTF 交易所:          ' + (ctfApproved ? '✅ 已授权' : '❌ 未授权'));
  console.log('Neg Risk CTF:       ' + (negRiskApproved ? '✅ 已授权' : '❌ 未授权'));
  console.log('');

  const needsApproval = !ctfApproved || !negRiskApproved ||
    ctfUsdcAllowance.lt(ethers.constants.MaxUint256.div(2)) ||
    negRiskUsdcAllowance.lt(ethers.constants.MaxUint256.div(2));

  if (needsApproval) {
    console.log('⚠️  检测到缺少授权!');
    console.log('   订单将因"余额/授权不足"而失败');
    console.log('');
  }

  if (command === 'approve') {
    console.log('─── 正在授权所有必需的合约 ───');
    console.log('');

    const usdcWithSigner = usdc.connect(wallet);
    const ctfTokenWithSigner = ctfToken.connect(wallet);

    // Get current gas price and add buffer
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice?.mul(2) || ethers.utils.parseUnits('50', 'gwei');
    console.log('Gas 价格:', ethers.utils.formatUnits(gasPrice, 'gwei'), 'gwei');
    console.log('');

    // 1. Approve USDC.e for CTF Exchange
    if (ctfUsdcAllowance.lt(ethers.constants.MaxUint256.div(2))) {
      console.log('1. 正在为 CTF 交易所授权 USDC.e...');
      const tx1 = await usdcWithSigner.approve(CTF_EXCHANGE, ethers.constants.MaxUint256, { gasPrice });
      console.log('   交易:', tx1.hash);
      await tx1.wait();
      console.log('   ✅ 已确认');
    } else {
      console.log('1. USDC.e CTF 交易所: 已授权 ✓');
    }

    // 2. Approve USDC.e for Neg Risk CTF Exchange
    if (negRiskUsdcAllowance.lt(ethers.constants.MaxUint256.div(2))) {
      console.log('2. 正在为 Neg Risk CTF 交易所授权 USDC.e...');
      const tx2 = await usdcWithSigner.approve(NEG_RISK_CTF_EXCHANGE, ethers.constants.MaxUint256, { gasPrice });
      console.log('   交易:', tx2.hash);
      await tx2.wait();
      console.log('   ✅ 已确认');
    } else {
      console.log('2. USDC.e Neg Risk CTF: 已授权 ✓');
    }

    // 3. Approve CTF Tokens for CTF Exchange
    if (!ctfApproved) {
      console.log('3. 正在为 CTF 交易所授权 CTF 代币...');
      const tx3 = await ctfTokenWithSigner.setApprovalForAll(CTF_EXCHANGE, true, { gasPrice });
      console.log('   交易:', tx3.hash);
      await tx3.wait();
      console.log('   ✅ 已确认');
    } else {
      console.log('3. CTF 代币 CTF 交易所: 已授权 ✓');
    }

    // 4. Approve CTF Tokens for Neg Risk CTF Exchange
    if (!negRiskApproved) {
      console.log('4. 正在为 Neg Risk CTF 交易所授权 CTF 代币...');
      const tx4 = await ctfTokenWithSigner.setApprovalForAll(NEG_RISK_CTF_EXCHANGE, true, { gasPrice });
      console.log('   交易:', tx4.hash);
      await tx4.wait();
      console.log('   ✅ 已确认');
    } else {
      console.log('4. CTF 代币 Neg Risk CTF: 已授权 ✓');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ 所有授权完成! 您现在可以在 Polymarket 上交易了。');
    console.log('═══════════════════════════════════════════════════════════════');

  } else {
    console.log('─── 命令 ───');
    console.log('  check   - 检查当前授权状态 (默认)');
    console.log('  approve - 授权所有合约以进行交易');
    console.log('');
    console.log('示例: POLYMARKET_PRIVATE_KEY=0x... npx tsx scripts/check-ctf-approval.ts approve');
  }
}

main().catch(console.error);
