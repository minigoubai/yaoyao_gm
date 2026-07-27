# GIWA Lottery — API Reference

> Complete contract ABI, frontend JavaScript API, and contract events.

---

## Smart Contract Address

```
0x18a4c3F5d4f1eb06b41B37D7855A158d21c73025
```
[View on Explorer](https://sepolia-explorer.giwa.io/address/0x18a4c3F5d4f1eb06b41B37D7855A158d21c73025)

---

## Contract Functions

### Public/External Functions

#### `buyTickets(uint256 _count) → payable`
Buy `_count` tickets for the current round.

| Param | Type | Description |
|-------|------|-------------|
| `_count` | `uint256` | Number of tickets to buy (1–50) |

- Sends `ticketPrice × _count` ETH with the call
- Tickets are immediately credited to `msg.sender`
- If `maxPlayers` reached, auto-triggers draw immediately

**Gas:** ~46,000 per ticket

---

#### `enter() → payable`
Convenience alias for `buyTickets(1)`. Buys exactly 1 ticket.

---

#### `ticketPrice() → uint256`
Returns the price of one ticket in wei.

**Returns:** `1000000000000000` (0.001 ETH = 10¹⁵ wei)

---

#### `maxPlayers() → uint256`
Returns the maximum number of players per round. `0` = unlimited.

**Returns:** `50`

---

#### `lotteryDuration() → uint256`
Returns the round duration in seconds.

**Returns:** `3600` (1 hour)

---

#### `currentPhase() → uint8`
Returns the current contract phase.

| Value | Phase | Description |
|-------|-------|-------------|
| `0` | `PHASE_ENTRY` | Tickets can be purchased |
| `1` | `PHASE_DRAW` | Drawing in progress (V4: not used, draw is instant) |

---

#### `endTime() → uint256`
Returns the Unix timestamp when the current round ends (timer expiration).

---

#### `round() → uint256`
Returns the current round number (starts at 1).

---

#### `totalRounds() → uint256`
Returns the total number of completed rounds (all-time).

---

#### `MANAGER() → address`
Returns the manager (deployer) address.

**Returns:** `0xC43943A9FFe891e175cb21190e642831e6403259`

---

#### `checkTimerExpiry() → external`
**The main auto-draw function.** Checks if `block.timestamp >= endTime` and the current phase is `PHASE_ENTRY`.

- If **no players**: extends timer by `lotteryDuration` seconds
- If **has players**: locks `blockhash(block.number)` → calls `_drawAndDistribute()` → completes draw in one transaction

**No parameters. No access control (anyone can call).**

**Gas:** 25,000 (no draw) to 180,000 (50 players, full draw)

---

#### `getRecentRounds(uint256 count) → RoundInfo[]`
Returns the last `count` completed rounds (up to 24).

| Param | Type | Description |
|-------|------|-------------|
| `count` | `uint256` | Number of rounds to return (max 24) |

**Returns:** Array of `RoundInfo` structs (see below).

```solidity
struct RoundInfo {
    uint256 round;           // round number
    uint256 prizePool;       // total ETH in pool
    uint256 fee;             // manager fee
    uint256 distAmount;      // distributable amount (pool - fee)
    uint256 drawBlockNumber; // block number of draw
    bytes32 drawBlockHash;  // block hash used as randomness seed
    bytes32 drawTxHash;     // TX hash (set by manager)
    uint256 playerCount;     // number of players
    address winner1;         // 1st prize address (or 0x0)
    address winner2;         // 2nd prize address (or 0x0)
    address winner3;         // 3rd prize address (or 0x0)
}
```

---

#### `getPrizeDistribution() → uint256[4]`
Returns the prize distribution in basis points.

**Returns:** `[5000, 2500, 1500, 1000]`

- Index 0: 1st prize (50%)
- Index 1: 2nd prize (25%)
- Index 2: 3rd prize (15%)
- Index 3: manager fee (10%)

---

#### `ticketCount(address _player) → uint256`
Returns the number of tickets held by `_player` in the current round.

---

#### `recentRounds(uint256 index) → RoundInfo`
Direct getter for the ring buffer. `index` must be `0`–`23`.

---

#### `lastFee() → uint256`
Manager fee from the most recent draw (in wei).

---

#### `lastDistAmount() → uint256`
Distributable amount from the most recent draw (in wei).

---

#### `drawBlockNumber() → uint256`
Block number at which the current/most recent randomness was locked.

---

#### `drawBlockHash() → bytes32`
Block hash used as randomness seed for the current/most recent draw.

---

#### `lastDrawTxHash() → bytes32`
Transaction hash of the draw. Set manually by manager via `recordDrawTx()`.

---

### Manager-Only Functions

#### `configure(uint256 _price, uint256 _max, uint256 _dur) → onlyManager`
Update contract parameters. Can only be called by the manager.

| Param | Type | Description |
|-------|------|-------------|
| `_price` | `uint256` | New ticket price in wei (must be > 0) |
| `_max` | `uint256` | New max players (0 = unlimited) |
| `_dur` | `uint256` | New round duration in seconds (0 = default 3600s) |

**Gas:** ~45,000

---

#### `recordDrawTx(bytes32 _txHash) → onlyManager`
Record the transaction hash of the draw. Called by manager after the draw transaction is confirmed.

| Param | Type | Description |
|-------|------|-------------|
| `_txHash` | `bytes32` | The transaction hash of the draw |

---

## Contract Events

### `TicketsPurchased(address indexed player, uint256 count, uint256 amount, uint256 round)`
Emitted when a player buys ticket(s).

```
player: 0xC43943A9FFe891e175cb21190e642831e6403259
count: 3
amount: 3000000000000000 (0.003 ETH)
round: 5
```

---

### `WinnersPicked(address w1, uint256 p1, address w2, uint256 p2, address w3, uint256 p3)`
Emitted when winners are selected and prizes distributed.

```
w1: 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B
p1: 25000000000000000 (0.025 ETH, 50% of pool)
w2: 0x... (2nd winner)
p2: 12500000000000000 (0.0125 ETH, 25% of pool)
w3: 0x... (3rd winner)
p3: 7500000000000000 (0.0075 ETH, 15% of pool)
```

---

### `LotteryReset(uint256 newRound)`
Emitted when a new round starts after draw completion.

```
newRound: 6
```

---

### `TimerExpired(uint256 endTime)`
Emitted when `checkTimerExpiry()` is called and the timer has expired.

```
endTime: 1699999999
```

---

### `PhaseChanged(uint8 indexed from, uint8 indexed to)`
Emitted when phase transitions occur.

---

## Frontend JavaScript API

### `connectWallet()`
Initiates MetaMask connection. Shows wallet selection modal.

```javascript
async function connectWallet() {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    signer = provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    account = await signer.getAddress();
}
```

---

### `connectWith(walletType)`
Connects a specific wallet type. Supported: `metamask`, `coinbase`, `trust`, `okx`, `rabby`.

```javascript
async function connectWith('metamask') { ... }
async function connectWith('coinbase') { window.CoinbaseWalletExtension ... }
```

---

### `loadData()`
Refreshes all UI data from the contract. Called on page load and on every new block.

```javascript
async function loadData() {
    const [price, max, dur, phase, end, r, pool, total, manager] = await Promise.all([
        roContract.ticketPrice(),
        roContract.maxPlayers(),
        roContract.lotteryDuration(),
        roContract.currentPhase(),
        roContract.endTime(),
        roContract.round(),
        provider.getBalance(CONTRACT_ADDRESS),
        roContract.totalRounds(),
        roContract.MANAGER()
    ]);
    // Update UI elements
}
```

---

### `buyTickets()`
Buys ticket(s). Validates count, calls `contract.buyTickets()`.

```javascript
async function buyTickets() {
    const count = parseInt(document.getElementById('ticketCount').value);
    const price = await roContract.ticketPrice();
    const value = price.mul(count);
    const tx = await contract.buyTickets(count, { value });
    await tx.wait();
    // Show success, refresh UI
}
```

---

### `loadHistory()`
Loads the last 24 completed rounds and renders them.

```javascript
async function loadHistory() {
    const rounds = await roContract.getRecentRounds(24);
    rounds.forEach(r => {
        // Render round info card
    });
}
```

---

### `formatAddress(address) → string`
Truncates address to `0x1234...abcd` format.

---

### `formatEther(wei) → string`
Formats wei as ETH string with 4 decimal places.

---

### `calculatePrize(poolWei, basisPoints) → string`
Calculates prize amount from pool size and basis points.

```javascript
function calculatePrize(pool, bp) {
    return formatEther(pool.mul(bp).div(10000));
}
```

---

## Network Configuration (GIWA Sepolia)

```javascript
const RPC_URL = 'https://sepolia-rpc.giwa.io';
const CHAIN_ID = 91342;  // 0x165CE
const EXPLORER = 'https://sepolia-explorer.giwa.io/';
```
