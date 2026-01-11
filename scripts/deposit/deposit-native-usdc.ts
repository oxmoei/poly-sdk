/**
 * Deposit Native USDC to Polymarket via Bridge
 *
 * This script:
 * 1. Gets your unique deposit address from the Polymarket Bridge
 * 2. Sends Native USDC (on Polygon) to that address
 * 3. The bridge automatically converts it to USDC.e for your Polymarket account
 *
 * Usage:
 *   # Check deposit address and balances only
 *   POLYMARKET_PRIVATE_KEY=0x... npx tsx scripts/deposit-native-usdc.ts check
 *
 *   # Deposit Native USDC (amount in USDC, e.g., 5.0)
 *   POLYMARKET_PRIVATE_KEY=0x... npx tsx scripts/deposit-native-usdc.ts deposit 5.0
 */

import { config } from 'dotenv';
import path from 'path';
import { providers, Wallet, Contract, utils } from 'ethers';
import { BridgeClient, BRIDGE_TOKENS } from '../src/clients/bridge-client.js';

// Load .env from package root
config({ path: path.resolve(process.cwd(), '.env') });

// Configuration
const PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY || process.env.POLY_PRIVKEY || '';
const RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';

// Token addresses
const NATIVE_USDC_ADDRESS = BRIDGE_TOKENS.POLYGON_NATIVE_USDC; // 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
const USDC_E_ADDRESS = BRIDGE_TOKENS.POLYGON_USDC_E; // 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174

// ERC20 ABI (minimal for balance and transfer)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'check';
  const amount = args[1] || '5.0';

  if (!PRIVATE_KEY) {
    console.log('Error: Set POLYMARKET_PRIVATE_KEY environment variable');
    console.log('');
    console.log('Usage:');
    console.log('  POLYMARKET_PRIVATE_KEY=0x... npx tsx scripts/deposit-native-usdc.ts check');
    console.log('  POLYMARKET_PRIVATE_KEY=0x... npx tsx scripts/deposit-native-usdc.ts deposit 5.0');
    return;
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       NATIVE USDC DEPOSIT TO POLYMARKET                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Setup provider and wallet (ethers v5)
  const provider = new providers.JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);
  const bridge = new BridgeClient();

  console.log(`Wallet: ${wallet.address}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log('');

  // Get token contracts
  const nativeUsdc = new Contract(NATIVE_USDC_ADDRESS, ERC20_ABI, wallet);
  const usdcE = new Contract(USDC_E_ADDRESS, ERC20_ABI, wallet);

  // Check balances
  console.log('─── Current Balances ───');
  const maticBalance = await provider.getBalance(wallet.address);
  const nativeUsdcBalance = await nativeUsdc.balanceOf(wallet.address);
  const usdcEBalance = await usdcE.balanceOf(wallet.address);

  console.log(`MATIC: ${utils.formatEther(maticBalance)}`);
  console.log(`Native USDC: ${utils.formatUnits(nativeUsdcBalance, 6)}`);
  console.log(`USDC.e: ${utils.formatUnits(usdcEBalance, 6)}`);
  console.log('');

  // Get deposit address for Polygon Native USDC
  console.log('─── Getting Deposit Address ───');
  try {
    // The Bridge API returns a single EVM address for all EVM chains
    // API Response: { address: { evm: "0x...", svm: "...", btc: "..." } }
    const response = await fetch('https://bridge.polymarket.com/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: wallet.address }),
    });

    const data = await response.json() as {
      address: { evm: string; svm: string; btc: string };
      note: string;
    };

    const depositAddress = data.address.evm;
    if (!depositAddress) {
      console.log('Error: Could not get deposit address');
      console.log('Response:', JSON.stringify(data, null, 2));
      return;
    }

    console.log(`Chain: Polygon (137)`);
    console.log(`Token: Native USDC`);
    console.log(`Deposit Address: ${depositAddress}`);
    console.log(`Min Deposit: $2`);
    console.log('');

    if (command === 'check') {
      console.log('✓ Check complete. Use "deposit <amount>" to execute deposit.');
      return;
    }

    if (command === 'deposit') {
      const depositAmount = parseFloat(amount);

      if (depositAmount < 2) {
        console.log(`Error: Minimum deposit is $2, you specified $${depositAmount}`);
        return;
      }

      const nativeUsdcAvailable = parseFloat(utils.formatUnits(nativeUsdcBalance, 6));
      if (depositAmount > nativeUsdcAvailable) {
        console.log(`Error: Insufficient balance. You have ${nativeUsdcAvailable} Native USDC`);
        return;
      }

      console.log('─── Executing Deposit ───');
      console.log(`Amount: ${depositAmount} USDC`);
      console.log(`To: ${depositAddress}`);
      console.log('');

      // Convert amount to wei (6 decimals for USDC)
      const amountWei = utils.parseUnits(amount, 6);

      // Get current gas price and add buffer for Polygon
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice?.mul(120).div(100); // 20% buffer

      console.log(`Gas price: ${utils.formatUnits(gasPrice || 0, 'gwei')} gwei`);
      console.log('Sending transaction...');

      const tx = await nativeUsdc.transfer(depositAddress, amountWei, {
        gasPrice: gasPrice,
      });
      console.log(`Transaction hash: ${tx.hash}`);
      console.log(`PolygonScan: https://polygonscan.com/tx/${tx.hash}`);
      console.log('');

      console.log('Waiting for confirmation...');
      const receipt = await tx.wait();
      console.log(`Status: ${receipt?.status === 1 ? '✓ Success' : '✗ Failed'}`);
      console.log(`Block: ${receipt?.blockNumber}`);
      console.log(`Gas used: ${receipt?.gasUsed}`);
      console.log('');

      if (receipt?.status === 1) {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('✓ Deposit transaction successful!');
        console.log('');
        console.log('The bridge will automatically:');
        console.log('1. Detect your deposit');
        console.log('2. Convert Native USDC to USDC.e');
        console.log('3. Credit your Polymarket account');
        console.log('');
        console.log('This typically takes 1-5 minutes.');
        console.log('');
        console.log('Check your new balances with:');
        console.log('  POLY_PRIVKEY=0x... npx tsx scripts/deposit-native-usdc.ts check');
        console.log('═══════════════════════════════════════════════════════════');
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    throw error;
  }
}

main().catch(console.error);
