# Poly-SDK 脚本

用于测试和操作 Polymarket 的实用脚本。

## 环境设置

设置环境变量：

```bash
export POLYMARKET_PRIVATE_KEY=0x...  # 您的私钥
```

或内联传递：

```bash
POLYMARKET_PRIVATE_KEY=0x... npx tsx scripts/...
```

**注意：** 为了向后兼容，某些脚本也可能接受 `POLY_PRIVKEY` 或 `PRIVATE_KEY`，但 `POLYMARKET_PRIVATE_KEY` 是推荐的标准。

---

## 目录结构

```
scripts/
├── approvals/          # ERC20/ERC1155 授权脚本
├── deposit/            # USDC 存款和交换脚本
├── trading/            # 订单和持仓管理
├── wallet/             # 钱包余额和验证
├── verify/             # API 验证测试
└── research/           # 市场研究和分析
```

---

## 脚本参考

### `approvals/` - 代币授权

| 脚本 | 描述 |
|------|------|
| `check-allowance.ts` | 检查 CTF Exchange 的 USDC 授权额度 |
| `check-all-allowances.ts` | 一次性检查所有代币授权额度 |
| `check-ctf-approval.ts` | 检查 CTF/ERC1155 授权状态 |
| `approve-neg-risk.ts` | 授权 USDC 给 Neg Risk Exchange |
| `approve-erc1155.ts` | 授权 ERC1155 给 CTF Exchange |
| `approve-neg-risk-erc1155.ts` | 授权 ERC1155 给 Neg Risk Exchange |

```bash
# 检查所有授权额度
npx tsx scripts/approvals/check-all-allowances.ts

# 授权给 neg risk 市场
npx tsx scripts/approvals/approve-neg-risk.ts
```

---

### `deposit/` - 存款和交换

| 脚本 | 描述 |
|------|------|
| `deposit-native-usdc.ts` | 通过桥接存入原生 USDC |
| `deposit-usdc.ts` | 直接存入 USDC.e |
| `swap-usdc-to-usdce.ts` | 在 DEX 上将原生 USDC → USDC.e |

```bash
# 检查存款地址和状态
npx tsx scripts/deposit/deposit-native-usdc.ts check

# 通过桥接存入 $50
npx tsx scripts/deposit/deposit-native-usdc.ts deposit 50
```

**重要提示：** Polymarket CTF 操作需要 USDC.e。原生 USDC 必须先交换或桥接。

---

### `trading/` - 订单和持仓

| 脚本 | 描述 |
|------|------|
| `check-orders.ts` | 查看未结订单和近期交易 |
| `test-order.ts` | 测试订单下单 |
| `sell-nvidia-positions.ts` | 卖出特定持仓 |

```bash
# 检查未结订单
npx tsx scripts/trading/check-orders.ts

# 测试订单下单
npx tsx scripts/trading/test-order.ts
```

---

### `wallet/` - 钱包管理

| 脚本 | 描述 |
|------|------|
| `check-wallet-balances.ts` | 检查所有钱包余额 |
| `verify-wallet-tools.ts` | 验证钱包 MCP 工具 |
| `test-wallet-operations.ts` | 测试钱包操作 |

```bash
# 检查余额
npx tsx scripts/wallet/check-wallet-balances.ts
```

---

### `verify/` - API 验证

| 脚本 | 描述 |
|------|------|
| `verify-all-apis.ts` | 验证所有 API 端点 |
| `test-search-mcp.ts` | 测试 MCP 搜索工具 |
| `test-approve-trading.ts` | 测试交易授权 |

```bash
# 验证所有 API 是否工作
npx tsx scripts/verify/verify-all-apis.ts
```

---

### `research/` - 市场研究

| 脚本 | 描述 |
|------|------|
| `research-markets.ts` | ARB/MM/Hybrid 市场分析 |

```bash
# 寻找套利和做市机会
npx tsx scripts/research/research-markets.ts
```

---

## 重要概念

### USDC 类型

| 代币 | 地址 | 用途 |
|------|------|------|
| USDC.e (桥接) | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` | **CTF 必需** |
| 原生 USDC | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` | 必须交换为 USDC.e |

### 有效价格

Polymarket 订单簿具有镜像属性：
- 以价格 P 买入 YES = 以价格 (1-P) 卖出 NO

```
effectiveBuyYes = min(YES.bestAsk, 1 - NO.bestBid)
effectiveBuyNo = min(NO.bestAsk, 1 - YES.bestBid)
```

### 套利检测

| 类型 | 条件 | 操作 |
|------|------|------|
| 多头套利 | `effectiveBuyYes + effectiveBuyNo < 1` | 买入两者，合并 |
| 空头套利 | `effectiveSellYes + effectiveSellNo > 1` | 拆分，卖出两者 |

