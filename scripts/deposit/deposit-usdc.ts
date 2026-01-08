/**
 * Deposit USDC.e to Polymarket for Trading
 *
 * Polymarket requires USDC to be deposited into their trading contracts
 * before you can place orders.
 *
 * Usage:
 *   POLYMARKET_PRIVATE_KEY=0x... npx tsx scripts/deposit-usdc.ts [amount]
 *
 * Examples:
 *   POLYMARKET_PRIVATE_KEY=0x... npx tsx scripts/deposit-usdc.ts 100    # Deposit 100 USDC
 *   POLYMARKET_PRIVATE_KEY=0x... npx tsx scripts/deposit-usdc.ts        # Check balance only
 */

import { ethers } from 'ethers';

const PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY || process.env.POLY_PRIVKEY || '';

// Contract addresses on Polygon
const USDC_E_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const NEG_RISK_CTF_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';
const NEG_RISK_ADAPTER = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296';

// ABIs
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

const EXCHANGE_ABI = [
  'function getPolyProxyWalletAddress(address _addr) view returns (address)',
  'function isValidNonce(address usr, uint256 nonce) view returns (bool)',
];

async function main() {
  if (!PRIVATE_KEY) {
    console.error('Error: Set POLYMARKET_PRIVATE_KEY environment variable');
    process.exit(1);
  }

  const amount = process.argv[2] ? parseFloat(process.argv[2]) : 0;

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       POLYMARKET USDC DEPOSIT                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Connect to Polygon
  const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const address = wallet.address;

  console.log(`Wallet: ${address}`);
  console.log('');

  // Get USDC contract
  const usdc = new ethers.Contract(USDC_E_ADDRESS, ERC20_ABI, wallet);
  const exchange = new ethers.Contract(CTF_EXCHANGE, EXCHANGE_ABI, provider);

  // Check balances
  console.log('─── Current Status ───');

  const walletBalance = await usdc.balanceOf(address);
  const walletBalanceUsdc = parseFloat(ethers.utils.formatUnits(walletBalance, 6));
  console.log(`Wallet USDC.e Balance: ${walletBalanceUsdc.toFixed(6)} USDC`);

  // Check allowances
  const ctfAllowance = await usdc.allowance(address, CTF_EXCHANGE);
  const negRiskAllowance = await usdc.allowance(address, NEG_RISK_CTF_EXCHANGE);
  const adapterAllowance = await usdc.allowance(address, NEG_RISK_ADAPTER);

  console.log(`CTF Exchange Allowance: ${ethers.utils.formatUnits(ctfAllowance, 6)} USDC`);
  console.log(`Neg Risk Exchange Allowance: ${ethers.utils.formatUnits(negRiskAllowance, 6)} USDC`);
  console.log(`Neg Risk Adapter Allowance: ${ethers.utils.formatUnits(adapterAllowance, 6)} USDC`);
  console.log('');

  // Try to get proxy wallet address
  try {
    const proxyWallet = await exchange.getPolyProxyWalletAddress(address);
    console.log(`Proxy Wallet: ${proxyWallet}`);

    // Check proxy wallet balance
    const proxyBalance = await usdc.balanceOf(proxyWallet);
    const proxyBalanceUsdc = parseFloat(ethers.utils.formatUnits(proxyBalance, 6));
    console.log(`Proxy USDC.e Balance: ${proxyBalanceUsdc.toFixed(6)} USDC`);
  } catch (e) {
    console.log('Proxy Wallet: Not created yet');
  }
  console.log('');

  if (amount <= 0) {
    console.log('─── Usage ───');
    console.log('To deposit USDC, run with an amount:');
    console.log('  POLYMARKET_PRIVATE_KEY=0x... npx tsx scripts/deposit-usdc.ts 100');
    console.log('');
    console.log('Note: Polymarket uses a proxy wallet system. You may need to:');
    console.log('1. Visit polymarket.com and connect your wallet');
    console.log('2. Click "Deposit" to create your proxy wallet');
    console.log('3. The proxy wallet will be funded from your wallet');
    return;
  }

  // Approve and deposit
  console.log(`─── Depositing ${amount} USDC ───`);

  if (amount > walletBalanceUsdc) {
    console.error(`Error: Insufficient balance. You have ${walletBalanceUsdc} USDC`);
    process.exit(1);
  }

  const amountWei = ethers.utils.parseUnits(amount.toString(), 6);

  // Check if we need to approve
  const MAX_UINT256 = ethers.constants.MaxUint256;

  if (ctfAllowance.lt(amountWei)) {
    console.log('Approving CTF Exchange...');
    const tx1 = await usdc.approve(CTF_EXCHANGE, MAX_UINT256);
    console.log(`  TX: ${tx1.hash}`);
    await tx1.wait();
    console.log('  ✓ Approved');
  }

  if (negRiskAllowance.lt(amountWei)) {
    console.log('Approving Neg Risk CTF Exchange...');
    const tx2 = await usdc.approve(NEG_RISK_CTF_EXCHANGE, MAX_UINT256);
    console.log(`  TX: ${tx2.hash}`);
    await tx2.wait();
    console.log('  ✓ Approved');
  }

  if (adapterAllowance.lt(amountWei)) {
    console.log('Approving Neg Risk Adapter...');
    const tx3 = await usdc.approve(NEG_RISK_ADAPTER, MAX_UINT256);
    console.log(`  TX: ${tx3.hash}`);
    await tx3.wait();
    console.log('  ✓ Approved');
  }

  console.log('');
  console.log('✅ All approvals complete!');
  console.log('');
  console.log('Note: Polymarket trading balance should now be available.');
  console.log('The USDC remains in your wallet but is authorized for trading.');
  console.log('');
  console.log('If you still see "not enough balance" errors, try:');
  console.log('1. Visit polymarket.com and deposit via their UI');
  console.log('2. This creates a proxy wallet and funds it');
}

main().catch(console.error);
