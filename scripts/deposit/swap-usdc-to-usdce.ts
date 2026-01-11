/**
 * USDC to USDC.e Conversion Script
 *
 * This script provides two methods to get USDC.e on Polygon for Polymarket trading:
 *
 * 1. SWAP (Polygon): Swap native USDC to USDC.e using QuickSwap V3
 * 2. BRIDGE (Cross-chain): Deposit from Ethereum/other chains via Polymarket Bridge
 *
 * Usage:
 *   # Check current balances
 *   npx ts-node scripts/swap-usdc-to-usdce.ts
 *
 *   # Swap 100 USDC to USDC.e on Polygon
 *   npx ts-node scripts/swap-usdc-to-usdce.ts swap 100
 *
 *   # Dry run swap (no transaction)
 *   npx ts-node scripts/swap-usdc-to-usdce.ts swap 100 --dry-run
 *
 *   # Get bridge deposit addresses
 *   npx ts-node scripts/swap-usdc-to-usdce.ts bridge
 *
 *   # Check supported bridge assets
 *   npx ts-node scripts/swap-usdc-to-usdce.ts bridge --assets
 *
 * Contract addresses:
 * - Native USDC (Polygon): 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
 * - USDC.e (Polygon):      0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
 * - QuickSwap Router V3:   0xf5b509bB0909a69B1c207E495f687a596C168E12
 */

import { config } from 'dotenv';
import path from 'path';
import { ethers, Contract, Wallet } from 'ethers';
import { BridgeClient, BRIDGE_TOKENS } from '../src/clients/bridge-client.js';

// Load .env from package root
config({ path: path.resolve(process.cwd(), '.env') });

// Configuration
const PRIVATE_KEY = process.env.POLYMARKET_PRIVATE_KEY || '';
const RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';

// Token addresses
const NATIVE_USDC = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

// QuickSwap V3 SwapRouter
const QUICKSWAP_ROUTER = '0xf5b509bB0909a69B1c207E495f687a596C168E12';

// ABIs
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const QUICKSWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 limitSqrtPrice)) external payable returns (uint256 amountOut)',
];

// ===== Helper Functions =====

async function checkBalances(wallet: Wallet) {
  const provider = wallet.provider!;
  const nativeUsdc = new Contract(NATIVE_USDC, ERC20_ABI, wallet);
  const usdce = new Contract(USDC_E, ERC20_ABI, wallet);

  const [nativeBalance, usdceBalance, maticBalance] = await Promise.all([
    nativeUsdc.balanceOf(wallet.address),
    usdce.balanceOf(wallet.address),
    provider.getBalance(wallet.address),
  ]);

  return { nativeBalance, usdceBalance, maticBalance };
}

function printBalances(
  nativeBalance: ethers.BigNumber,
  usdceBalance: ethers.BigNumber,
  maticBalance: ethers.BigNumber
) {
  console.log('Current Polygon Balances:');
  console.log(`  Native USDC: ${ethers.utils.formatUnits(nativeBalance, 6)}`);
  console.log(`  USDC.e:      ${ethers.utils.formatUnits(usdceBalance, 6)}`);
  console.log(`  MATIC:       ${ethers.utils.formatEther(maticBalance)}`);
  console.log();
}

// ===== Swap Command =====

async function executeSwap(wallet: Wallet, amount?: string, dryRun = false) {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       USDC → USDC.e SWAP (QuickSwap V3)                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Wallet: ${wallet.address}\n`);

  const { nativeBalance, usdceBalance, maticBalance } = await checkBalances(wallet);
  printBalances(nativeBalance, usdceBalance, maticBalance);

  if (nativeBalance.eq(0)) {
    console.log('❌ No native USDC to swap. Exiting.');
    return;
  }

  // Parse amount to swap
  let amountToSwap = nativeBalance;
  if (amount) {
    const requestedAmount = ethers.utils.parseUnits(amount, 6);
    if (requestedAmount.gt(nativeBalance)) {
      console.log(`❌ Requested ${amount} but only have ${ethers.utils.formatUnits(nativeBalance, 6)}`);
      return;
    }
    amountToSwap = requestedAmount;
  }

  console.log(`Amount to swap: ${ethers.utils.formatUnits(amountToSwap, 6)} USDC\n`);
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No transactions will be executed\n');
  }

  // Check and approve if needed
  const nativeUsdc = new Contract(NATIVE_USDC, ERC20_ABI, wallet);
  const router = new Contract(QUICKSWAP_ROUTER, QUICKSWAP_ROUTER_ABI, wallet);
  const currentAllowance = await nativeUsdc.allowance(wallet.address, QUICKSWAP_ROUTER);

  if (currentAllowance.lt(amountToSwap)) {
    console.log('Step 1: Approving USDC for QuickSwap Router...');

    if (!dryRun) {
      const approveTx = await nativeUsdc.approve(QUICKSWAP_ROUTER, ethers.constants.MaxUint256);
      console.log(`  TX: ${approveTx.hash}`);
      await approveTx.wait();
      console.log('  ✅ Approved\n');
    } else {
      console.log('  [DRY RUN] Would approve USDC\n');
    }
  } else {
    console.log('Step 1: USDC already approved ✅\n');
  }

  // Execute swap
  console.log('Step 2: Executing swap...');

  // Calculate minimum output (0.5% slippage)
  const minAmountOut = amountToSwap.mul(995).div(1000);

  const swapParams = {
    tokenIn: NATIVE_USDC,
    tokenOut: USDC_E,
    recipient: wallet.address,
    deadline: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    amountIn: amountToSwap,
    amountOutMinimum: minAmountOut,
    limitSqrtPrice: 0, // No price limit
  };

  console.log('  Swap parameters:');
  console.log(`    Input:  ${ethers.utils.formatUnits(amountToSwap, 6)} USDC`);
  console.log(`    Min Output: ${ethers.utils.formatUnits(minAmountOut, 6)} USDC.e`);
  console.log(`    Slippage: 0.5%`);
  console.log();

  if (!dryRun) {
    try {
      const tx = await router.exactInputSingle(swapParams);
      console.log(`  TX: ${tx.hash}`);
      console.log('  Waiting for confirmation...');

      const receipt = await tx.wait();
      console.log(`  ✅ Confirmed in block ${receipt.blockNumber}`);
      console.log(`  Gas used: ${receipt.gasUsed.toString()}`);

      // Check new balances
      const { nativeBalance: newNative, usdceBalance: newUsdce } = await checkBalances(wallet);

      console.log('\nNew Balances:');
      console.log(`  Native USDC: ${ethers.utils.formatUnits(newNative, 6)}`);
      console.log(`  USDC.e:      ${ethers.utils.formatUnits(newUsdce, 6)}`);

      const received = newUsdce.sub(usdceBalance);
      console.log(`\n✅ Received: ${ethers.utils.formatUnits(received, 6)} USDC.e`);
    } catch (error) {
      console.log(`\n❌ Swap failed: ${(error as Error).message}`);
      printManualSwapInstructions(amountToSwap);
    }
  } else {
    console.log('  [DRY RUN] Would execute swap\n');
    console.log('Run without --dry-run to execute the swap.');
  }
}

function printManualSwapInstructions(amount: ethers.BigNumber) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('ALTERNATIVE: Manual swap on QuickSwap\n');
  console.log('1. Visit: https://quickswap.exchange/#/swap');
  console.log('2. Connect your wallet');
  console.log('3. Swap:');
  console.log(`   From: USDC (${NATIVE_USDC})`);
  console.log(`   To:   USDC.e (${USDC_E})`);
  console.log(`   Amount: ${ethers.utils.formatUnits(amount, 6)}`);
  console.log('4. Execute swap');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// ===== Bridge Command =====

async function executeBridge(wallet: Wallet, showAssets = false) {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       POLYMARKET CROSS-CHAIN BRIDGE                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const bridge = new BridgeClient();

  if (showAssets) {
    console.log('Fetching supported bridge assets...\n');

    try {
      const assets = await bridge.getSupportedAssets();

      console.log('Supported Assets for Bridge Deposits:');
      console.log('─────────────────────────────────────────────────────────────\n');

      // Group by chain
      const byChain = new Map<number, typeof assets>();
      for (const asset of assets) {
        const existing = byChain.get(asset.chainId) || [];
        existing.push(asset);
        byChain.set(asset.chainId, existing);
      }

      for (const [chainId, chainAssets] of byChain) {
        const chainName = chainAssets[0].chainName;
        console.log(`${chainName} (Chain ID: ${chainId}):`);

        for (const asset of chainAssets) {
          const status = asset.active ? '✅' : '❌';
          console.log(`  ${status} ${asset.tokenSymbol.padEnd(8)} - ${asset.tokenName}`);
          console.log(`     Address: ${asset.tokenAddress}`);
          console.log(`     Min deposit: ${asset.minDeposit} (~$${asset.minDepositUsd})`);
        }
        console.log();
      }
    } catch (error) {
      console.log(`❌ Failed to fetch assets: ${(error as Error).message}`);
      console.log('\nNote: The bridge API may not be publicly accessible.');
      console.log('Visit https://polymarket.com to deposit through the web interface.\n');
      printKnownTokens();
    }
    return;
  }

  // Get deposit addresses
  console.log(`Wallet: ${wallet.address}\n`);
  console.log('Fetching deposit addresses...\n');

  try {
    const instructions = await bridge.getDepositInstructions(wallet.address);
    console.log(instructions);
  } catch (error) {
    console.log(`❌ Failed to get deposit addresses: ${(error as Error).message}`);
    console.log('\nNote: The bridge API may not be publicly accessible.');
    console.log('Visit https://polymarket.com to deposit through the web interface.\n');
    printKnownTokens();
    printManualBridgeInstructions();
  }
}

function printKnownTokens() {
  console.log('Known Token Addresses:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('Ethereum:');
  console.log(`  USDC:  ${BRIDGE_TOKENS.ETH_USDC}`);
  console.log(`  WETH:  ${BRIDGE_TOKENS.ETH_WETH}`);
  console.log(`  DAI:   ${BRIDGE_TOKENS.ETH_DAI}`);
  console.log('\nPolygon (Destination):');
  console.log(`  USDC.e:       ${BRIDGE_TOKENS.POLYGON_USDC_E}`);
  console.log(`  Native USDC:  ${BRIDGE_TOKENS.POLYGON_NATIVE_USDC}`);
  console.log();
}

function printManualBridgeInstructions() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('MANUAL BRIDGE OPTIONS:\n');
  console.log('Option 1: Polymarket Deposit (Recommended)');
  console.log('  1. Visit: https://polymarket.com');
  console.log('  2. Connect wallet → Click "Deposit"');
  console.log('  3. Select source chain and token');
  console.log('  4. Follow deposit instructions\n');
  console.log('Option 2: Official Polygon Bridge');
  console.log('  1. Visit: https://wallet.polygon.technology/polygon/bridge');
  console.log('  2. Bridge USDC from Ethereum to Polygon');
  console.log('  3. Use this script to swap to USDC.e\n');
  console.log('Option 3: Third-party Bridges');
  console.log('  - Jumper.exchange');
  console.log('  - Stargate.finance');
  console.log('  - Across.to');
  console.log('═══════════════════════════════════════════════════════════\n');
}

// ===== Main =====

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Check for private key
  if (!PRIVATE_KEY) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║       USDC.e CONVERSION TOOL                               ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('⚠️  No private key configured.\n');
    console.log('Set POLYMARKET_PRIVATE_KEY environment variable to use this tool.\n');
    console.log('Usage:');
    console.log('  # Check balances and swap on Polygon');
    console.log('  npx ts-node scripts/swap-usdc-to-usdce.ts swap [amount] [--dry-run]\n');
    console.log('  # Get bridge deposit addresses');
    console.log('  npx ts-node scripts/swap-usdc-to-usdce.ts bridge\n');
    console.log('  # Check supported bridge assets');
    console.log('  npx ts-node scripts/swap-usdc-to-usdce.ts bridge --assets\n');
    return;
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);

  switch (command) {
    case 'swap': {
      const amount = args.find((a) => !a.startsWith('--') && a !== 'swap');
      const dryRun = args.includes('--dry-run');
      await executeSwap(wallet, amount, dryRun);
      break;
    }

    case 'bridge': {
      const showAssets = args.includes('--assets');
      await executeBridge(wallet, showAssets);
      break;
    }

    default: {
      // Default: show balances and usage
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║       USDC.e CONVERSION TOOL                               ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');

      console.log(`Wallet: ${wallet.address}\n`);

      const { nativeBalance, usdceBalance, maticBalance } = await checkBalances(wallet);
      printBalances(nativeBalance, usdceBalance, maticBalance);

      console.log('Available Commands:');
      console.log('───────────────────────────────────────────────────────────────');
      console.log('');
      console.log('  swap [amount] [--dry-run]');
      console.log('    Swap native USDC to USDC.e on Polygon using QuickSwap');
      console.log('    Example: npx ts-node scripts/swap-usdc-to-usdce.ts swap 100');
      console.log('');
      console.log('  bridge');
      console.log('    Get deposit addresses for cross-chain deposits');
      console.log('    Example: npx ts-node scripts/swap-usdc-to-usdce.ts bridge');
      console.log('');
      console.log('  bridge --assets');
      console.log('    Show all supported bridge assets and chains');
      console.log('    Example: npx ts-node scripts/swap-usdc-to-usdce.ts bridge --assets');
      console.log('');
      console.log('───────────────────────────────────────────────────────────────');

      if (nativeBalance.gt(0)) {
        console.log(`\n💡 You have ${ethers.utils.formatUnits(nativeBalance, 6)} native USDC.`);
        console.log('   Run: npx ts-node scripts/swap-usdc-to-usdce.ts swap');
      }
    }
  }
}

main().catch(console.error);
