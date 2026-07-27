# GIWA Lottery — Deployment Guide

> How to deploy, configure, and operate your own GIWA Lottery instance.

---

## Network Configuration

### GIWA Sepolia (Current — Testnet)

| Parameter | Value |
|-----------|-------|
| Network Name | GIWA Sepolia |
| RPC URL | `https://sepolia-rpc.giwa.io` |
| Chain ID | `91342` (hex: `0x165CE`) |
| Symbol | GIWA |
| Block Explorer | `https://sepolia-explorer.giwa.io/` |

---

## Prerequisites

- **Node.js** 18+ and npm
- **Git**
- **MetaMask** or any EVM-compatible wallet
- **Testnet ETH** from the GIWA Sepolia faucet

---

## Quick Start

```bash
git clone https://github.com/minigoubai/yaoyao_gm.git
cd yaoyao_gm
npm install
cp .env.example .env  # then edit with your private key
npx hardhat compile
npx hardhat run scripts/deploy_v4.mjs --network giwa-sepolia
```

---

## Step-by-Step Deployment

### 1. Clone & Install

```bash
git clone https://github.com/minigoubai/yaoyao_gm.git
cd yaoyao_gm
npm install
```

### 2. Configure Environment

Create a `.env` file:

```bash
DEPLOYER_PRIVATE_KEY=0x_your_64_char_hex_private_key
CONTRACT_ADDRESS=   # will be filled after deployment
GIWA_SEPOLIA_RPC=https://sepolia-rpc.giwa.io
```

### 3. Add GIWA Sepolia to MetaMask

```
Network Name: GIWA Sepolia
RPC URL: https://sepolia-rpc.giwa.io
Chain ID: 91342
Symbol: GIWA
Block Explorer: https://sepolia-explorer.giwa.io/
```

### 4. Get Testnet ETH

Visit the GIWA Sepolia faucet and receive testnet GIWA tokens.

### 5. Compile Contracts

```bash
npx hardhat compile
```

Output:
```
Compiled 2 Solidity files successfully
evm target: paris
```

### 6. Deploy Contract

```bash
npx hardhat run scripts/deploy_v4.mjs --network giwa-sepolia
```

Expected output:
```
Wallet: 0xC43943A9FFe891e175cb21190e642831e6403259
Deployed to: 0xYourNewContractAddress
Configured
Saved to deployed.json
```

### 7. Update Configuration

After deployment, update `.env`:

```bash
CONTRACT_ADDRESS=0xYourNewContractAddress
```

### 8. Update Frontend

Run the update script to embed the new contract address and ABI into `index.html`:

```bash
python3 update_frontend.py
# or manually:
# Replace CONTRACT_ADDRESS in index.html
# Replace CONTRACT_ABI in index.html with new ABI from artifacts/
```

### 9. Push Frontend to GitHub Pages

```bash
git checkout gh-pages
git merge main  # or cherry-pick the commit with updated contract
git push origin gh-pages
```

GitHub Pages will deploy automatically. Access at:
```
https://minigoubai.github.io/yaoyao_gm/
```

---

## Contract Configuration

After deployment, configure the lottery parameters:

```javascript
// In deploy_v4.mjs or a separate script:
const c = new ethers.Contract(ADDR, artifact.abi, wallet);

await c.configure(
    ethers.utils.parseEther('0.001'),  // ticket price: 0.001 ETH
    50,                                  // max players: 50
    3600                                 // duration: 3600 seconds (1 hour)
);
```

### Parameter Reference

| Param | Value | Description |
|-------|-------|-------------|
| Ticket Price | `0.001 ETH` | Cost per ticket in ETH |
| Max Players | `50` | Auto-draw when reached (0 = unlimited) |
| Duration | `3600s` | Round length in seconds |

---

## Automatic Drawing Setup

The lottery requires periodic calls to `checkTimerExpiry()` to trigger draws when the timer expires.

### Option A: Cron Tab (Linux/macOS)

```bash
# Add to crontab
crontab -e

# Every 5 minutes, run the check script
*/5 * * * * cd /path/to/giwa-lottery && /usr/bin/node scripts/check_timer.js >> /var/log/lottery.log 2>&1
```

### Option B: Hermes Cron Job (Already Configured)

The existing Hermes agent has a cron job set up:
- **Job ID:** `695f981c7d93`
- **Schedule:** `*/5 * * * *`
- **Command:** `cd /home/ubuntu/giwa-lottery && node scripts/check_timer.js`

To recreate if needed:
```
Create a new cron job: every 5 minutes
Prompt: 运行 /home/ubuntu/giwa-lottery/check_timer.js，检查 GIWA Lottery 合约状态并自动触发开奖。
Workdir: /home/ubuntu/giwa-lottery
```

### Option C: GitHub Actions (Alternative)

See the `.github/workflows/` directory for a GitHub Actions workflow that can trigger draws via HTTP requests to a relay server.

---

## GitHub Actions Deployment

### Workflow: Auto Deploy on Merge to Main

```yaml
# .github/workflows/deploy.yml
name: Deploy Frontend

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
          publish_branch: gh-pages
```

### Workflow: Scheduled Draw Trigger

For serverless draw triggering:

```yaml
# .github/workflows/draw-trigger.yml
name: Trigger Draw

on:
  schedule:
    - cron: '*/5 * * * *'  # every 5 minutes

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Call draw relay
        run: |
          curl -X POST https://your-relay-server.com/draw \
            -d '{"contract":"0x18a4c3F5d4f1eb06b41B37D7855A158d21c73025"}'
```

---

## Contract Upgrade Process

Since the contract is **non-upgradeable** (no proxy), upgrading requires redeploying:

1. Make changes to `contracts/GiwaLotteryV4.sol`
2. `npx hardhat compile`
3. `npx hardhat run scripts/deploy_v4.mjs --network giwa-sepolia`
4. Update `CONTRACT_ADDRESS` in `.env`
5. Update `index.html` with new address and ABI
6. Push to `gh-pages`
7. Verify new contract on explorer
8. Notify users of new contract address

---

## Gas Cost Estimates

| Operation | Gas Used (avg) |
|-----------|---------------|
| Deploy contract | ~2,200,000 |
| `buyTickets(1)` | ~46,000 |
| `buyTickets(10)` | ~180,000 |
| `buyTickets(50)` | ~900,000 |
| `checkTimerExpiry()` (no draw) | ~25,000 |
| `checkTimerExpiry()` (10 players) | ~120,000 |
| `checkTimerExpiry()` (50 players) | ~180,000 |
| `configure()` | ~45,000 |

---

## Verifying Contract on Explorer

After deployment, verify the source code on the explorer:

```bash
npx hardhat verify --network giwa-sepolia <CONTRACT_ADDRESS>
```

Or via the explorer UI:
1. Navigate to: `https://sepolia-explorer.giwa.io/address/<CONTRACT_ADDRESS>`
2. Click **"Code"** tab
3. Click **"Verify & Publish"**
4. Select compiler version `0.8.20`
5. Paste the contents of `contracts/GiwaLotteryV4.sol`
6. Click **"Verify"**

---

## Hardhat Configuration Reference

```javascript
// hardhat.config.js
module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 5000 }
    }
  },
  networks: {
    'giwa-sepolia': {
      url: 'https://sepolia-rpc.giwa.io',
      accounts: [process.env.DEPLOYER_PRIVATE_KEY]
    }
  }
};
```

---

## Troubleshooting

### "insufficient funds for gas"
Your wallet doesn't have enough GIWA tokens to pay for gas. Get testnet ETH from the faucet.

### "nonce too low"
Your wallet's nonce is out of sync. In MetaMask: **Settings → Advanced → Reset Account**.

### "block gas limit exceeded"
The transaction uses more gas than the block can hold. This shouldn't happen normally — check your `gasLimit` in the calling script.

### "contract source code not verified"
Run `npx hardhat verify` or manually verify on the explorer. Unverified contracts show no source code on the explorer.
