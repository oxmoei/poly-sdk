#!/usr/bin/env tsx
/**
 * Poly-SDK Command List CLI
 * 
 * 列出所有可用的 examples 和 scripts 命令
 * 使用方法: npx tsx list-commands.ts [examples|scripts|all]
 */

interface ScriptCommand {
  file: string;
  description: string;
  auth: boolean;
  usage?: string;
}

interface ScriptSection {
  name: string;
  description: string;
  commands: ScriptCommand[];
}

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

// 工具函数
const colorize = (text: string, color: string) => `${color}${text}${colors.reset}`;
const bold = (text: string) => colorize(text, colors.bright);
const dim = (text: string) => colorize(text, colors.dim);
const success = (text: string) => colorize(text, colors.green);
const warning = (text: string) => colorize(text, colors.yellow);
const info = (text: string) => colorize(text, colors.cyan);
const error = (text: string) => colorize(text, colors.red);

// 分隔线
const separator = (char: string = '═', length: number = 80) => {
  return colorize(char.repeat(length), colors.cyan);
};

// 打印标题
const printTitle = (title: string, emoji: string = '📋') => {
  console.log('\n' + separator());
  console.log(bold(`  ${emoji}  ${title}`));
  console.log(separator() + '\n');
};

// 打印分组标题
const printSection = (title: string, emoji: string = '▸') => {
  console.log(bold(`\n${emoji} ${title}`));
  console.log(dim('─'.repeat(78)));
};

// Examples 数据
const examples = [
  {
    id: '01',
    name: 'basic',
    file: '01-basic-usage.ts',
    description: '基础用法 - 获取热门市场和订单簿数据',
    auth: false,
    category: '只读操作',
  },
  {
    id: '02',
    name: 'smart-money',
    file: '02-smart-money.ts',
    description: '聪明钱分析 - 分析钱包交易表现',
    auth: false,
    category: '只读操作',
  },
  {
    id: '03',
    name: 'market-analysis',
    file: '03-market-analysis.ts',
    description: '市场分析 - 搜索和分析市场',
    auth: false,
    category: '只读操作',
  },
  {
    id: '04',
    name: 'kline',
    file: '04-kline-aggregation.ts',
    description: 'K线聚合 - 获取价格历史数据',
    auth: false,
    category: '只读操作',
  },
  {
    id: '05',
    name: 'follow-wallet',
    file: '05-follow-wallet-strategy.ts',
    description: '跟单策略 - 基于聪明钱信号模拟跟单',
    auth: false,
    category: '只读操作',
  },
  {
    id: '06',
    name: 'services',
    file: '06-services-demo.ts',
    description: '服务演示 - 展示高级服务抽象',
    auth: false,
    category: '只读操作',
  },
  {
    id: '07',
    name: 'realtime',
    file: '07-realtime-websocket.ts',
    description: '实时 WebSocket - 实时市场数据流',
    auth: false,
    category: '只读操作',
  },
  {
    id: '08',
    name: 'trading',
    file: '08-trading-orders.ts',
    description: '交易订单 - 下单和订单管理',
    auth: true,
    category: '交易操作',
  },
  {
    id: '09',
    name: 'rewards',
    file: '09-rewards-tracking.ts',
    description: '奖励追踪 - 追踪流动性提供者奖励',
    auth: true,
    category: '交易操作',
  },
  {
    id: '10',
    name: 'ctf',
    file: '10-ctf-operations.ts',
    description: 'CTF 操作 - Split/Merge/Redeem（需要 USDC.e）',
    auth: true,
    category: '链上操作',
  },
  {
    id: '11',
    name: 'live-arb',
    file: '11-live-arbitrage-scan.ts',
    description: '实时套利扫描 - 扫描市场寻找套利机会',
    auth: false,
    category: '套利检测',
  },
  {
    id: '12',
    name: 'trending-arb',
    file: '12-trending-arb-monitor.ts',
    description: '热门套利监控 - 持续监控热门市场',
    auth: false,
    category: '套利检测',
  },
  {
    id: '13',
    name: 'arb-service',
    file: '13-arbitrage-service.ts',
    description: '套利服务完整流程 - 完整的套利工作流程',
    auth: true,
    category: '套利执行',
  },
];

// Scripts 数据
const scripts: Record<string, ScriptSection> = {
  approvals: {
    name: '代币授权',
    description: 'ERC20/ERC1155 授权脚本',
    commands: [
      {
        file: 'check-all-allowances.ts',
        description: '检查所有授权状态',
        auth: true,
      },
      {
        file: 'check-allowance.ts',
        description: '检查 USDC 授权',
        auth: true,
      },
      {
        file: 'check-ctf-approval.ts',
        description: '检查 CTF/ERC1155 授权状态',
        auth: true,
      },
      {
        file: 'approve-erc1155.ts',
        description: '授权 ERC1155 代币（用于交易 YES/NO tokens）',
        auth: true,
      },
      {
        file: 'approve-neg-risk.ts',
        description: '授权 USDC 给 Neg Risk Exchange',
        auth: true,
      },
      {
        file: 'approve-neg-risk-erc1155.ts',
        description: '授权 ERC1155 给 Neg Risk Exchange',
        auth: true,
      },
    ],
  },
  deposit: {
    name: '充值和交换',
    description: 'USDC 充值和交换',
    commands: [
      {
        file: 'deposit-native-usdc.ts',
        description: '通过 Bridge 充值原生 USDC（自动转换为 USDC.e）',
        auth: true,
        usage: 'check | deposit <amount>',
      },
      {
        file: 'deposit-usdc.ts',
        description: '直接充值 USDC.e',
        auth: true,
      },
      {
        file: 'swap-usdc-to-usdce.ts',
        description: '将原生 USDC 交换为 USDC.e',
        auth: true,
      },
    ],
  },
  trading: {
    name: '订单和仓位管理',
    description: '交易订单和仓位管理',
    commands: [
      {
        file: 'check-orders.ts',
        description: '查看当前订单和交易历史',
        auth: true,
      },
      {
        file: 'test-order.ts',
        description: '测试订单下单（GTC vs FOK）',
        auth: true,
      },
    ],
  },
  wallet: {
    name: '钱包管理',
    description: '钱包余额和验证',
    commands: [
      {
        file: 'check-wallet-balances.ts',
        description: '检查钱包余额（USDC、MATIC、代币等）',
        auth: true,
      },
      {
        file: 'verify-wallet-tools.ts',
        description: '验证钱包工具',
        auth: true,
      },
      {
        file: 'test-wallet-operations.ts',
        description: '测试钱包操作',
        auth: true,
      },
    ],
  },
  'dip-arb': {
    name: 'Dip 套利自动交易',
    description: 'Polymarket 15 分钟加密货币 UP/DOWN 市场套利',
    commands: [
      {
        file: 'auto-trade.ts',
        description: '运行自动交易（支持 --eth, --btc, --sol, --xrp）',
        auth: true,
        usage: '--eth | --btc | --sol | --xrp [--dip=0.35] [--target=0.90] [--shares=50]',
      },
      {
        file: 'redeem-positions.ts',
        description: '赎回已结束市场的仓位',
        auth: true,
      },
      {
        file: 'scan-markets.ts',
        description: '扫描市场寻找套利机会',
        auth: false,
      },
    ],
  },
  'smart-money': {
    name: '聪明钱跟踪和跟单',
    description: '聪明钱跟踪和自动跟单',
    commands: [
      {
        file: '01-e2e.ts',
        description: 'E2E 测试：完整跟单链路验证',
        auth: true,
      },
      {
        file: '02-e2e-low-level.ts',
        description: '底层测试：直接使用 WebSocket + Trading API',
        auth: true,
      },
      {
        file: '04-auto-copy-trading.ts',
        description: '自动跟单交易（完整功能）',
        auth: true,
      },
      {
        file: '05-auto-copy-simple.ts',
        description: '简化版自动跟单',
        auth: true,
      },
      {
        file: '06-real-copy-test.ts',
        description: '真实交易测试（⚠️ 会执行真实交易）',
        auth: true,
      },
    ],
  },
  arb: {
    name: '套利工具',
    description: '套利相关工具',
    commands: [
      {
        file: 'settle-position.ts',
        description: '清算仓位（市场结束后）',
        auth: true,
        usage: '[--merge] [--market <slug>]',
      },
      {
        file: 'token-rebalancer.ts',
        description: '代币再平衡器（维持 USDC/Token 比例）',
        auth: true,
      },
    ],
  },
  verify: {
    name: 'API 验证',
    description: 'API 验证测试',
    commands: [
      {
        file: 'verify-all-apis.ts',
        description: '验证所有 API 端点是否正常工作',
        auth: false,
      },
      {
        file: 'test-approve-trading.ts',
        description: '测试交易授权',
        auth: true,
      },
      {
        file: 'test-provider-fix.ts',
        description: '测试 Provider 修复',
        auth: false,
      },
      {
        file: 'test-search-mcp.ts',
        description: '测试 MCP 搜索工具',
        auth: false,
      },
    ],
  },
  research: {
    name: '市场研究',
    description: '市场研究和分析',
    commands: [
      {
        file: 'research-markets.ts',
        description: '寻找套利和做市机会',
        auth: false,
      },
    ],
  },
};

// 打印 Examples
const printExamples = () => {
  printTitle('Examples - 示例命令', '📚');

  // 按分类分组
  const categories = examples.reduce((acc, ex) => {
    if (!acc[ex.category]) acc[ex.category] = [];
    acc[ex.category].push(ex);
    return acc;
  }, {} as Record<string, typeof examples>);

  Object.entries(categories).forEach(([category, items]) => {
    printSection(category, '📁');
    
    items.forEach((ex) => {
      const authBadge = ex.auth ? warning('🔐 需私钥') : success('✅ 无需认证');
      const pnpmCmd = `pnpm example:${ex.name}`;
      const tsxCmd = `npx tsx examples/${ex.file}`;
      
      // 对生产级示例添加标识
      const isProduction = ex.id === '12' || ex.id === '13';
      const productionBadge = isProduction ? info('🚀 生产级') : '';
      
      console.log(`  ${bold(`[${ex.id}]`)} ${info(ex.description)} ${productionBadge}`);
      console.log(`    ${dim('命令:')} ${bold(pnpmCmd)}`);
      console.log(`    ${dim('或:')}    ${dim(tsxCmd)}`);
      console.log(`    ${authBadge}`);
      console.log('');
    });
  });
 
  console.log(dim('提示: 使用 pnpm example:<name> 或 npx tsx examples/<file> 运行示例；示例 12-13 为生产级版本，包含完整的错误处理、日志和监控功能\n'));
};

// 打印 Scripts
const printScripts = () => {
  printTitle('Scripts - 实用脚本', '🛠️');

  Object.entries(scripts).forEach(([dir, section]) => {
    printSection(`${section.name} - ${section.description}`, '📂');
    
    section.commands.forEach((cmd: ScriptCommand) => {
      const authBadge = cmd.auth ? warning('🔐 需私钥') : success('✅ 无需认证');
      const baseCmd = `npx tsx scripts/${dir}/${cmd.file}`;
      const fullCmd = cmd.usage ? `${baseCmd} ${cmd.usage}` : baseCmd;
      
      console.log(`  ${info(cmd.description)}`);
      console.log(`    ${dim('命令:')} ${bold(fullCmd)}`);
      console.log(`    ${authBadge}`);
      if (cmd.usage) {
        console.log(`    ${dim('参数:')} ${dim(cmd.usage)}`);
      }
      console.log('');
    });
  });

  console.log(dim('提示: 所有 scripts 都需要设置环境变量 POLYMARKET_PRIVATE_KEY（如需要私钥）\n'));
};

// 打印快速参考
const printQuickReference = () => {
  printTitle('快速参考', '⚡');

  console.log(bold('Examples 快速命令:'));
  examples.forEach((ex) => {
    console.log(`  ${bold(`pnpm example:${ex.name.padEnd(20)}`)} ${dim('//')} ${ex.description}`);
  });

  console.log('\n' + bold('生产级 Examples（推荐）:'));
  console.log(`  ${bold('npx tsx examples/12-trending-arb-monitor.ts')}          ${dim('// 生产级套利监控（只读）')}`);
  console.log(`  ${bold('npx tsx examples/13-arbitrage-service.ts')}             ${dim('// 生产级套利服务（带交易限额与监控）')}`);

  console.log('\n' + bold('常用 Scripts:'));
  console.log(`  ${bold('npx tsx scripts/wallet/check-wallet-balances.ts')}     ${dim('// 检查钱包余额')}`);
  console.log(`  ${bold('npx tsx scripts/approvals/check-all-allowances.ts')}    ${dim('// 检查所有授权')}`);
  console.log(`  ${bold('npx tsx scripts/trading/check-orders.ts')}              ${dim('// 查看订单')}`);
  console.log(`  ${bold('npx tsx scripts/dip-arb/auto-trade.ts --eth')}           ${dim('// ETH Dip 套利')}`);
  console.log(`  ${bold('npx tsx scripts/smart-money/04-auto-copy-trading.ts')}   ${dim('// 自动跟单')}`);
};

// 主函数
const main = () => {
  // 获取命令行参数（通过 globalThis 访问以兼容无 Node 类型定义的环境）
  const nodeProcess = (globalThis as any).process as { argv?: string[] } | undefined;
  const args = nodeProcess?.argv?.slice(2) ?? [];
  const mode = args[0] || 'all';

  // 打印头部
  console.log('\n' + separator('═', 80));
  console.log(bold('  🚀 Poly-SDK 命令列表工具'));
  console.log(separator('═', 80));

  switch (mode.toLowerCase()) {
    case 'examples':
    case 'ex':
      printExamples();
      break;
    
    case 'scripts':
    case 'sc':
      printScripts();
      break;
    
    case 'quick':
    case 'q':
      printQuickReference();
      break;
    
    case 'all':
    default:
      printExamples();
      printScripts();
      printQuickReference();
      break;
  }

  // 打印使用说明
  console.log(separator('═', 80));
  console.log(bold('使用方法:'));
  console.log(`  ${info('npx tsx list-commands.ts')}           ${dim('// 显示所有命令')}`);
  console.log(`  ${info('npx tsx list-commands.ts examples')}   ${dim('// 仅显示 Examples')}`);
  console.log(`  ${info('npx tsx list-commands.ts scripts')}   ${dim('// 仅显示 Scripts')}`);
  console.log(`  ${info('npx tsx list-commands.ts quick')}      ${dim('// 快速参考')}`);
  console.log(separator('═', 80) + '\n');
};

main();

