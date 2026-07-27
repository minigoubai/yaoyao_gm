# 🎰 GIWA Lottery

*A fully decentralized, auto-drawing lottery on GIWA Chain.*

[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue)](https://docs.soliditylang.org/)
[![EVM](https://img.shields.io/badge/EVM-Paris-green)](https://ethereum.org/en/developers/docs/evm/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Chain](https://img.shields.io/badge/Chain-GIWA%20Sepolia-cyan)](https://sepolia-explorer.giwa.io/)

---

## 🎮 Live Demo

**🌐 https://minigoubai.github.io/yaoyao_gm/**

> Connect your Web3 wallet → Buy a ticket → Wait 1 hour → Get paid automatically.

**Contract:** [`0x18a4c3F5d4f1eb06b41B37D7855A158d21c73025`](https://sepolia-explorer.giwa.io/address/0x18a4c3F5d4f1eb06b41B37D7855A158d21c73025)
**Explorer:** [sepolia-explorer.giwa.io](https://sepolia-explorer.giwa.io/)

---

## ✨ Key Features

| | |
|---|---|
| 🔗 **Fully Decentralized** | Smart contract on GIWA Chain — no server, no single point of failure |
| ⚡ **Auto Drawing** | Timer expires → blockhash locks → winners picked — automatically |
| 🎲 **Provably Fair** | Randomness seeded by `blockhash(block.number)` at draw time — cannot be manipulated |
| 👥 **One Person, Multiple Tickets** | Buy N tickets = N chances to win |
| 📜 **24-Round History** | Last 24 draws stored on-chain, publicly readable |
| 💰 **Transparent Pool** | 50% / 25% / 15% to winners, 10% management fee — all on-chain |
| 👛 **Multi-Wallet** | MetaMask · Coinbase Wallet · Trust Wallet · OKX Wallet · Rabby |

---

## 🚀 Quick Start

### Participate in 3 Steps

**1️⃣ Connect Wallet**
Open [the DApp](https://minigoubai.github.io/yaoyao_gm/), click **"Connect Wallet"**, approve in your Web3 wallet.

**2️⃣ Buy Ticket**
Click **"Buy Ticket"**, confirm the transaction. Cost: **0.001 ETH** per ticket.

**3️⃣ Wait for Auto Draw**
Timer expires → contract automatically draws winners → prizes sent directly to your wallet. No action needed.

---

## 🏆 Prize Distribution

```
┌────────────────────────────────────────────┐
│              PRIZE POOL                    │
│              100%                          │
├──────────────┬──────────────┬──────────────┤
│  🥇 1st      │  🥈 2nd      │  🥉 3rd      │
│  50%         │  25%         │  15%         │
│  ~0.0005 ETH │  ~0.00025 ETH│  ~0.00015 ETH│
│  (per winner)│  (per winner)│  (per winner)│
├──────────────┴──────────────┴──────────────┤
│  🔧 Manager Fee: 10%                       │
└────────────────────────────────────────────┘
```

*Example: 50 players × 0.001 ETH = 0.05 ETH pool. Winners get 0.025 / 0.0125 / 0.0075 ETH. Manager gets 0.005 ETH.*

**Edge Cases:** If two winners are the same address, their shares are combined automatically by the contract.

---

## ⚙️ How It Works

```
[Player] ──pay 0.001 ETH──▶ [Contract] ──if 50 players──▶ [AUTO DRAW]
                                         │
                                         ▼
                               ┌─────────────────┐
                               │  Timer Expires   │
                               │  blockhash locks │
                               │  Random seed set │
                               └────────┬────────┘
                                        ▼
                               ┌─────────────────┐
                               │ _drawAndDistribute │
                               │ • Pick 3 winners │
                               │ • Split prize    │
                               │ • Save history   │
                               │ • Reset round    │
                               └────────┬────────┘
                                        ▼
                               [Prize → Wallets] [Next Round Starts]
```

**Round Duration:** 1 hour (3600 seconds) — configurable by manager.
**Auto-Trigger:** Every 5 minutes via cron job calling `checkTimerExpiry()`.

---

## 📁 Project Structure

```
giwa-lottery/
├── contracts/
│   └── GiwaLotteryV4.sol      # Smart contract (Solidity 0.8.20)
├── scripts/
│   └── check_timer.js          # Cron script for auto-draw
├── index.html                  # Frontend (HTML/JS/ethers.js v5)
├── BUSINESS_PLAN.md           # Business plan
├── README.md                   # This file
└── docs/
    ├── TECHNICAL.md            # Technical deep-dive
    ├── API.md                  # Contract ABI & frontend API
    ├── DEPLOYMENT.md           # Deployment guide
    ├── FAQ.md                  # Frequently asked questions
    └── architecture.svg       # System architecture diagram
```

---

## 🛠 Technology Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | GIWA Chain (EVM Compatible) |
| Smart Contract | Solidity 0.8.20 |
| Framework | Hardhat |
| Frontend | Vanilla HTML/JS + ethers.js v5 |
| Hosting | GitHub Pages |
| DNS | sepolia-explorer.giwa.io |

---

## 🔗 Important Links

| Resource | URL |
|----------|-----|
| **DApp (Frontend)** | https://minigoubai.github.io/yaoyao_gm/ |
| **Contract Address** | https://sepolia-explorer.giwa.io/address/0x18a4c3F5d4f1eb06b41B37D7855A158d21c73025 |
| **Block Explorer** | https://sepolia-explorer.giwa.io/ |
| **GIWA Sepolia RPC** | https://sepolia-rpc.giwa.io |
| **GitHub Repo** | https://github.com/minigoubai/yaoyao_gm |

---

## 📚 Documentation

- [Technical Deep-Dive](docs/TECHNICAL.md) — Contract internals, security, randomness
- [API Reference](docs/API.md) — Contract ABI, frontend functions, events
- [Deployment Guide](docs/DEPLOYMENT.md) — Deploy your own instance
- [FAQ](docs/FAQ.md) — Common questions answered

---

## ⚠️ Disclaimer

This is an experimental project running on GIWA Sepolia **testnet**. Testnet tokens have no real value. Use at your own risk. This software is provided "as is", without warranty of any kind.

---

**GIWA Lottery** — *Fair. Transparent. Autonomous.*
