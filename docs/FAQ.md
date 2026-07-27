# GIWA Lottery — FAQ

> Frequently asked questions about the GIWA Lottery DApp.

---

## General

### What is GIWA Lottery?
GIWA Lottery is a fully decentralized lottery DApp running on the GIWA Chain. Users connect a Web3 wallet, pay 0.001 ETH per ticket, and when the timer expires, the smart contract automatically selects winners and sends prizes — no human intervention, no trusted party.

---

### What network is it on?
GIWA Sepolia testnet (Chain ID: 91342). Testnet tokens have no real monetary value. This is a testing environment before potential migration to the GIWA mainnet.

---

### Is this a real lottery with real money?
On the current **testnet**, no — testnet tokens are free and have no market value. If deployed on mainnet, yes — it would involve real ETH.

---

## Participation

### How do I participate?
1. Open [https://minigoubai.github.io/yaoyao_gm/](https://minigoubai.github.io/yaoyao_gm/)
2. Click **"Connect Wallet"** and approve in your Web3 wallet
3. Enter the number of tickets you want and click **"Buy Ticket"**
4. Confirm the transaction in your wallet
5. That's it — when the timer expires, winners are automatically selected

---

### How much does a ticket cost?
**0.001 ETH** per ticket (on current testnet).

---

### How long does one round last?
The default is **1 hour** (3600 seconds). The manager can change this via `configure()`.

---

### Can I buy multiple tickets?
Yes! Each ticket you buy gives you one additional chance to win. If you buy 5 tickets and your address is randomly selected as the 1st prize winner, you get the full 1st prize for **each of your 5 tickets** (all 5 are counted separately in the random draw).

---

### What's the maximum number of players?
The default is **50 players** per round. After 50 players, the draw triggers automatically regardless of the timer.

---

### What wallets are supported?
MetaMask, Coinbase Wallet, Trust Wallet, OKX Wallet, and Rabby Wallet. Any EVM-compatible wallet that supports `window.ethereum` will work.

---

## Drawing & Randomness

### How does the automatic drawing work?
When the timer expires, anyone can call `checkTimerExpiry()` on the smart contract. This function:
1. Checks if `block.timestamp >= endTime`
2. Locks `blockhash(block.number)` as the randomness seed
3. Runs `_drawAndDistribute()` — picks 3 winners, splits the prize pool, saves history, resets for the next round

**All in a single transaction.** No second step needed.

A cron job calls `checkTimerExpiry()` every 5 minutes to ensure the draw happens automatically even if no user is watching.

---

### Is the randomness truly random? Can it be manipulated?

The randomness uses `blockhash(block.number)` locked at the moment `checkTimerExpiry()` is called. Here's why it's secure:

1. **The block hash is unknown before the block is mined** — miners can't control it
2. **It's locked in the same transaction that triggers the draw** — no one (including the manager) can see the result before committing
3. **The player list and round number are also part of the seed** — even if someone predicted the blockhash, they'd also need to predict the entire `players` array
4. **The seed is stored permanently on-chain** — `drawBlockHash` becomes an immutable contract state variable

The main theoretical concern is **block proposers** (miners/validators) could theoretically influence `blockhash(block.number)`, but:
- On GIWA Chain with 1-hour rounds, the proposer for any specific block is not predictable in advance
- The attack cost vastly exceeds any potential gain from a lottery prize

---

### What happens if no one participates?
If the timer expires with **zero players**, the contract:
1. Saves an empty round record (with `playerCount = 0`, all winners as `0x0`)
2. Extends the timer by `lotteryDuration` (1 hour)
3. Resets `drawBlockHash` and `drawBlockNumber`
4. Continues waiting for participants

**No prize is distributed. No fees are taken.**

---

### What if only 1 or 2 people buy tickets?
The draw still happens normally. If there's only 1 player, that player gets 100% of the prize pool (after the 10% manager fee). If 2 players, the 1st prize winner gets their full share.

---

## Prize Distribution

### How are prizes distributed?

| Prize | Share | Example (50 players = 0.05 ETH pool) |
|-------|-------|---------------------------------------|
| 🥇 1st | 50% | 0.025 ETH |
| 🥈 2nd | 25% | 0.0125 ETH |
| 🥉 3rd | 15% | 0.0075 ETH |
| 🔧 Manager | 10% | 0.005 ETH |

The math is based on the **distributable amount** (90% of the pool after the manager fee is deducted).

---

### What if two winners are the same address?
The contract automatically handles this. If `winner1 == winner2`:
- Winner gets `FIRST_PRIZE_BP + SECOND_PRIZE_BP = 75%` of the pool
- Winner gets `FIRST_PRIZE_BP + THIRD_PRIZE_BP = 65%` if `winner1 == winner3`
- Winner gets `SECOND_PRIZE_BP + THIRD_PRIZE_BP = 40%` if `winner2 == winner3`

---

### When do I receive my prize?
**Immediately.** The prize is transferred to your wallet in the same transaction that draws the winners. You don't need to claim it — it arrives automatically.

---

## Fees & Costs

### What fees are there?
- **Ticket price:** 0.001 ETH per ticket (paid by buyers)
- **Manager fee:** 10% of the prize pool (automatically taken by the contract during draw)
- **Gas fees:** Paid for transactions (buying tickets, triggering the draw). Gas on GIWA Sepolia is extremely cheap compared to Ethereum mainnet.

---

### Where does the manager fee go?
It goes to the manager wallet: `0xC43943A9FFe891e175cb21190e642831e6403259`. Currently the manager is the deployer of the contract.

---

## Contract & Verification

### How can I verify the contract is real?
1. Go to [sepolia-explorer.giwa.io](https://sepolia-explorer.giwa.io/)
2. Search for or navigate to: `0x18a4c3F5d4f1eb06b41B37D7855A158d21c73025`
3. You can view:
   - **Code** tab: full Solidity source code (verified)
   - **Read Contract** tab: query all public state variables
   - **Write Contract** tab: interact with write functions
   - **Transactions** tab: full history of all lottery transactions

---

### Who controls the contract?
The **manager** (`0xC43943A9...`) can:
- Change ticket price, max players, and round duration via `configure()`
- Record the draw transaction hash via `recordDrawTx()`

The manager **cannot**:
- Change the randomness after it's locked
- Steal funds from the prize pool
- Prevent the draw from happening

---

### Can the contract be upgraded?
No. This is a **non-upgradeable proxy-free** contract. Once deployed, the code is permanent. Users can verify the source code on the explorer.

---

### What if the manager disappears?
The contract continues to function normally. `checkTimerExpiry()` can be called by **anyone** — there's no dependency on the manager for drawing. If the manager's address is known, users can always find and audit the contract.

---

## History & Transparency

### How can I see past results?
Use the **"History"** section on the [DApp frontend](https://minigoubai.github.io/yaoyao_gm/). It shows the last 24 completed rounds with:
- Round number and prize pool
- Draw block number (tracing code: `BLK#<number>`)
- Winner addresses and their prize amounts
- Number of participants

You can also query `getRecentRounds(24)` directly on the [block explorer](https://sepolia-explorer.giwa.io/address/0x18a4c3F5d4f1eb06b41B37D7855A158d21c73025#readContract).

---

### What does "追踪码 BLK#123456" mean?
`BLK#<number>` is the **draw block number** — the Ethereum block at which the randomness was locked and the draw was executed. You can look up this block on the [explorer](https://sepolia-explorer.giwa.io/) to verify the block hash and the exact transaction.

---

## Troubleshooting

### My transaction failed. What do I do?
Common reasons:
- **"insufficient funds"** — you don't have enough ETH to pay for tickets + gas
- **"wrong phase"** — the round has already ended (already in draw phase)
- **"exceeds maximum"** — tried to buy more than 50 tickets at once

Check the error message in your wallet's transaction details. If needed, look up the transaction on the explorer to see the revert reason.

---

### The page says "请先连接钱包" (Please connect wallet first)
Click the **"Connect Wallet"** button and approve the connection request in your Web3 wallet extension. Make sure you have a Web3 wallet installed (MetaMask recommended).

---

### The draw didn't happen when the timer expired
The cron job calls `checkTimerExpiry()` every 5 minutes. If the timer expired, the next cron run (within 5 minutes) will trigger the draw. If you want to trigger it manually, you can call `checkTimerExpiry()` yourself via the [block explorer's Write Contract](https://sepolia-explorer.giwa.io/address/0x18a4c3F5d4f1eb06b41B37D7855A158d21c73025#writeContract) tab.

---

## Contact & Support

### How do I contact the team?
This is a fully decentralized project. The smart contract runs autonomously — no team can shut it down or modify it. For questions, reach out through any GIWA community channel.

---

### Is this audited?
**Not yet.** The contract has been tested internally on testnet but has not undergone a professional security audit. Use at your own risk on testnet. Before any mainnet deployment, a professional audit is strongly recommended.
