# GIWA Lottery V2

🎰 Decentralized Multi-Prize Lottery on GIWA Chain (Sepolia Testnet)

## 功能特性

### 抽奖模式
- **阈值开奖** — 参与人数达到设定值自动开奖
- **定时开奖** — 到指定时间自动开奖
- **手动开奖** — 管理员随时触发

### 多等奖项
| 名次 | 比例 |
|------|------|
| 🥇 第1名 | 50% |
| 🥈 第2名 | 25% |
| 🥉 第3名 | 15% |
| ⚙️ 管理员费 | 10% |

### 公平随机（Commit-Reveal 方案）
1. 参与者在 Entry 阶段购买奖券
2. 达到阈值/定时后进入 Commit 阶段
3. 每人提交 `keccak256(随机数 + 地址)` 承诺
4. 所有承诺提交后进入 Reveal 阶段
5. 各人揭示自己的随机数
6. 合约混合所有人的随机数生成最终种子
7. 用种子选出3个不重复的中奖者

**优势：** 任何人（包括矿工）都无法提前预判结果，因为随机数在揭示前是保密的。

### 管理员功能
- 配置票价、阈值人数、定时时长
- 强制开奖 / 取消本轮退款
- 紧急提取

## 快速开始

```bash
# 安装依赖
npm install

# 部署（需要私钥）
export DEPLOYER_PRIVATE_KEY=0x你的私钥
node deploy.js

# 上传 GitHub
git add . && git commit -m "GIWA Lottery V2"
git remote add origin https://github.com/你的用户名/giwa-lottery.git
git push -u origin main
# Settings → Pages → Source: main branch
```

## 合约配置

```javascript
// 部署后配置示例
await contract.configure(
  ethers.utils.parseEther('0.001'), // 票价 0.001 ETH
  10,    // 10人阈值开奖（0=禁用）
  3600,  // 1小时定时开奖（0=禁用）
  1000   // 手续费 10% (bps)
);
```

## 网络信息

- **Chain ID:** 91342
- **RPC:** https://sepolia-rpc.giwa.io
- **Explorer:** https://sepolia-explorer.giwa.io

## 技术栈

- Solidity 0.8.20
- ethers.js v5
- Hardhat（仅编译用）
- 前端：原生 HTML/CSS/JS，无框架依赖
