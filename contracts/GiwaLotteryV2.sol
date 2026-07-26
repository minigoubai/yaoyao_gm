// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GiwaLotteryV2
 * @notice GIWA Sepolia 多等奖抽奖合约 — B方案：一人可购买多张票
 * @dev 优化版：custom errors + 移除动态数组 uniquePlayers + 固定10%管理费
 *      存储布局：slot0(40+32*4=168b<256b) slot1(32*5=160b<256b) slot2+3+4+5 mappings
 */
contract GiwaLotteryV2 {

    // ==== 常量 ====
    uint256 private constant BASIS_POINTS    = 10000;
    uint256 private constant FIRST_PRIZE_BP  = 5000;
    uint256 private constant SECOND_PRIZE_BP = 2500;
    uint256 private constant THIRD_PRIZE_BP  = 1500;
    uint256 private constant MANAGER_FEE_BP  = 1000; // 固定10%

    uint8 private constant PHASE_ENTRY   = 0;
    uint8 private constant PHASE_COMMIT  = 1;
    uint8 private constant PHASE_REVEAL = 2;

    // ==== 错误 ====
    error OnlyManager();
    error WrongPhase(uint8 cur, uint8 exp);
    error InsufficientPayment();
    error InvalidConfig();
    error ZeroAddress();
    error NoPlayers();
    error AlreadyCommitted();
    error NotYetCommitted();
    error InvalidTicketIndex();
    error NotAllCommitted();
    error TransferFailed();

    // ==== 不可变 ====
    address public immutable MANAGER;

    // ==== 存储 (优化布局) ====
    // slot 0: 40 + 32*4 = 168b ≤ 256b
    address public pendingManager;
    uint256 public ticketPrice;
    uint256 public maxPlayers;
    uint256 public lotteryDuration;
    uint8   public currentPhase;

    // slot 1: 32*5 = 160b ≤ 256b
    uint256 public round;
    uint256 public startTime;
    uint256 public endTime;
    uint256 public prizePool;
    uint256 public totalCommits;
    uint256 public uniquePlayerCount;

    // slot 2: players array
    address[] public players;

    // slot 3: ticketCount
    mapping(address => uint256) public ticketCount;
    // slot 4: ticketCommitments
    mapping(bytes32 => bytes32) public ticketCommitments;
    // slot 5: ticketRevealed
    mapping(bytes32 => uint256) public ticketRevealed;

    // ==== 事件 ====
    event PhaseChanged(uint8 indexed from, uint8 indexed to);
    event TicketsPurchased(address indexed player, uint256 count, uint256 amount, uint256 round);
    event CommitmentSubmitted(address indexed player, uint256 ticketIndex);
    event WinnersPicked(address w1, uint256 p1, address w2, uint256 p2, address w3, uint256 p3);
    event LotteryReset(uint256 newRound);
    event ManagerUpdated(address indexed oldMgr, address indexed newMgr);
    event ThresholdReached(uint256 count);
    event TimerExpired(uint256 endTime);

    // ==== 修饰符 ====
    modifier onlyManager() { if (msg.sender != MANAGER) revert OnlyManager(); _; }
    modifier atPhase(uint8 _phase) { if (currentPhase != _phase) revert WrongPhase(currentPhase, _phase); _; }

    // ==== 构造函数 ====
    constructor() {
        MANAGER = msg.sender;
        round = 1;
        currentPhase = PHASE_ENTRY;
        ticketPrice = 0.001 ether;
        startTime = block.timestamp;
    }

    receive() external payable {}

    // ======================== ENTRY ========================
    function enter() external payable atPhase(PHASE_ENTRY) { _buyTickets(1); }
    function buyTickets(uint256 _count) external payable atPhase(PHASE_ENTRY) { _buyTickets(_count); }

    function _buyTickets(uint256 _count) internal {
        if (_count == 0 || _count > 50) revert InvalidConfig();
        uint256 cost = ticketPrice * _count;
        if (msg.value < cost) revert InsufficientPayment();

        bool isNew = ticketCount[msg.sender] == 0;
        for (uint256 i = 0; i < _count; i++) players.push(msg.sender);
        ticketCount[msg.sender] += _count;
        prizePool += cost;
        if (isNew) uniquePlayerCount++;

        if (msg.value > cost) _safeTransfer(payable(msg.sender), msg.value - cost);

        emit TicketsPurchased(msg.sender, _count, cost, round);

        if (maxPlayers > 0 && uniquePlayerCount >= maxPlayers) {
            emit ThresholdReached(uniquePlayerCount);
            _toCommit();
        }
    }

    // ======================== COMMIT ========================
    function commitTicket(uint256 _idx, bytes32 _hash) external atPhase(PHASE_COMMIT) {
        if (_idx >= players.length) revert InvalidTicketIndex();
        if (players[_idx] != msg.sender) revert InvalidTicketIndex();
        bytes32 key = _key(msg.sender, _idx);
        if (ticketCommitments[key] != bytes32(0)) revert AlreadyCommitted();

        ticketCommitments[key] = _hash;
        unchecked { totalCommits++; }
        emit CommitmentSubmitted(msg.sender, _idx);
        if (totalCommits == players.length) _toReveal();
    }

    function commitTicketsBatch(uint256[] calldata _idxs, bytes32[] calldata _hashes) external atPhase(PHASE_COMMIT) {
        if (_idxs.length != _hashes.length) revert InvalidConfig();
        uint256 n = players.length;
        uint256 committed = totalCommits;
        for (uint256 i = 0; i < _idxs.length; i++) {
            uint256 idx = _idxs[i];
            if (idx >= n || players[idx] != msg.sender) continue;
            bytes32 key = _key(msg.sender, idx);
            if (ticketCommitments[key] == bytes32(0)) {
                ticketCommitments[key] = _hashes[i];
                unchecked { committed++; }
                emit CommitmentSubmitted(msg.sender, idx);
            }
        }
        totalCommits = committed;
        if (totalCommits == n) _toReveal();
    }

    // ======================== REVEAL ========================
    function revealTicket(uint256 _idx, uint256 _rnd) external atPhase(PHASE_REVEAL) {
        bytes32 key = _key(msg.sender, _idx);
        if (ticketCommitments[key] == bytes32(0)) revert NotYetCommitted();
        if (keccak256(abi.encode(_rnd, msg.sender, _idx)) != ticketCommitments[key]) revert InvalidConfig();
        ticketRevealed[key] = _rnd;
    }

    function revealTicketsBatch(uint256[] calldata _idxs, uint256[] calldata _rnds) external atPhase(PHASE_REVEAL) {
        if (_idxs.length != _rnds.length) revert InvalidConfig();
        for (uint256 i = 0; i < _idxs.length; i++) {
            bytes32 key = _key(msg.sender, _idxs[i]);
            if (ticketCommitments[key] != bytes32(0) &&
                keccak256(abi.encode(_rnds[i], msg.sender, _idxs[i])) == ticketCommitments[key]) {
                ticketRevealed[key] = _rnds[i];
            }
        }
    }

    // ======================== DRAW ========================
    function draw() external atPhase(PHASE_REVEAL) {
        if (totalCommits < players.length) revert NotAllCommitted();
        _drawAndDistribute();
    }


    function checkTimerExpiry() external {
        if (endTime == 0) return;
        if (block.timestamp < endTime) return;
        emit TimerExpired(endTime);
        if (currentPhase == PHASE_ENTRY) {
            _toCommit();
        } else if (currentPhase == PHASE_COMMIT) {
            if (totalCommits < players.length && players.length > 0) {
                // Commit阶段超时：取消本轮并退款所有玩家
                _cancelAndRefund();
            } else if (totalCommits >= players.length) {
                _toReveal();
            }
        }
    }

    function _cancelAndRefund() internal {
        uint256 n = players.length;
        if (n == 0) return;
        uint256 refund = ticketPrice;
        for (uint256 i = 0; i < n; i++) {
            address p = players[i];
            uint256 cnt = ticketCount[p];
            if (cnt > 0) {
                ticketCount[p] = 0;
                _safeTransfer(payable(p), refund * cnt);
            }
        }
        _reset();
    }

    function forceCancelCommit() external onlyManager atPhase(PHASE_COMMIT) {
        _cancelAndRefund();
    }


    // ======================== ADMIN ========================
    function configure(uint256 _price, uint256 _max, uint256 _dur) external onlyManager {
        if (_price == 0) revert InvalidConfig();
        ticketPrice = _price;
        maxPlayers = _max;
        lotteryDuration = _dur;
        startTime = block.timestamp;
        endTime = _dur > 0 ? block.timestamp + _dur : 0;
    }

    function forceStartCommit() external {
        if (currentPhase != PHASE_ENTRY) revert WrongPhase(currentPhase, 0);
        if (players.length == 0) revert NoPlayers();
        _toCommit();
    }

    function forceDraw() external onlyManager atPhase(PHASE_REVEAL) { _drawAndDistribute(); }

    function transferManager(address _new) external onlyManager {
        if (_new == address(0)) revert ZeroAddress();
        pendingManager = _new;
    }

    function claimManager() external {
        if (msg.sender != pendingManager) revert OnlyManager();
        pendingManager = address(0);
        emit ManagerUpdated(MANAGER, msg.sender);
    }

    function emergencyWithdraw(address payable _to) external onlyManager {
        if (_to == address(0)) revert ZeroAddress();
        uint256 bal = address(this).balance;
        if (bal > 0) _safeTransfer(_to, bal);
    }

    function cancelRound() external onlyManager atPhase(PHASE_ENTRY) {
        uint256 n = players.length;
        if (n == 0) revert NoPlayers();
        uint256 refund = ticketPrice;
        for (uint256 i = 0; i < n; i++) {
            address p = players[i];
            uint256 cnt = ticketCount[p];
            if (cnt > 0) {
                ticketCount[p] = 0;
                _safeTransfer(payable(p), refund * cnt);
            }
        }
        _reset();
    }

    // ======================== INTERNAL ========================
    function _key(address _p, uint256 _i) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(_p, _i));
    }

    function _toCommit() private {
        emit PhaseChanged(currentPhase, PHASE_COMMIT);
        currentPhase = PHASE_COMMIT;
    }

    function _toReveal() private {
        emit PhaseChanged(currentPhase, PHASE_REVEAL);
        currentPhase = PHASE_REVEAL;
    }

    function _drawAndDistribute() private {
        uint256 n = players.length;
        uint256 pool = address(this).balance;
        uint256 fee = (pool * MANAGER_FEE_BP) / BASIS_POINTS;
        uint256 dist = pool - fee;

        // 混合所有随机数生成种子
        bytes32 seed = keccak256(abi.encode(players, round, block.timestamp, block.coinbase, block.prevrandao, block.number));
        for (uint256 i = 0; i < n; i++) {
            seed = keccak256(abi.encode(seed, ticketRevealed[_key(players[i], i)]));
        }

        // 选3个不同 ticket 索引
        uint256[3] memory sel = _pickThree(seed, n);
        address w1 = players[sel[0]];
        address w2 = players[sel[1]];
        address w3 = players[sel[2]];

        // 分配奖金
        if (w1 == w2 && w1 == w3) {
            _safeTransfer(payable(w1), dist);
        } else if (w1 == w2) {
            _safeTransfer(payable(w1), (dist * (FIRST_PRIZE_BP + SECOND_PRIZE_BP)) / BASIS_POINTS);
            _safeTransfer(payable(w3), (dist * THIRD_PRIZE_BP) / BASIS_POINTS);
        } else if (w1 == w3) {
            _safeTransfer(payable(w1), (dist * (FIRST_PRIZE_BP + THIRD_PRIZE_BP)) / BASIS_POINTS);
            _safeTransfer(payable(w2), (dist * SECOND_PRIZE_BP) / BASIS_POINTS);
        } else if (w2 == w3) {
            _safeTransfer(payable(w1), (dist * FIRST_PRIZE_BP) / BASIS_POINTS);
            _safeTransfer(payable(w2), (dist * (SECOND_PRIZE_BP + THIRD_PRIZE_BP)) / BASIS_POINTS);
        } else {
            _safeTransfer(payable(w1), (dist * FIRST_PRIZE_BP) / BASIS_POINTS);
            _safeTransfer(payable(w2), (dist * SECOND_PRIZE_BP) / BASIS_POINTS);
            _safeTransfer(payable(w3), (dist * THIRD_PRIZE_BP) / BASIS_POINTS);
        }

        if (fee > 0) _safeTransfer(payable(MANAGER), fee);

        emit WinnersPicked(w1,
            w1 == w2 && w1 == w3 ? dist : (dist * FIRST_PRIZE_BP) / BASIS_POINTS,
            w2,
            w2 == w3 ? (dist * (SECOND_PRIZE_BP + THIRD_PRIZE_BP)) / BASIS_POINTS : (dist * SECOND_PRIZE_BP) / BASIS_POINTS,
            w3,
            w1 == w3 && w1 != w2 ? (dist * (FIRST_PRIZE_BP + THIRD_PRIZE_BP)) / BASIS_POINTS : (dist * THIRD_PRIZE_BP) / BASIS_POINTS
        );

        _reset();
    }

    function _pickThree(bytes32 _seed, uint256 _n) private pure returns (uint256[3] memory) {
        uint256 r0 = uint256(keccak256(abi.encode(_seed, "r1"))) % _n;
        uint256 r1 = uint256(keccak256(abi.encode(_seed, "r2"))) % _n;
        uint256 r2 = uint256(keccak256(abi.encode(_seed, "r3"))) % _n;
        if (r1 == r0) r1 = (r1 + 1) % _n;
        if (r2 == r0 || r2 == r1) r2 = (r2 + 1) % _n;
        return [r0, r1, r2];
    }

    function _reset() private {
        uint256 n = players.length;
        for (uint256 i = 0; i < n; i++) ticketCount[players[i]] = 0;
        delete players;
        totalCommits = 0;
        prizePool = 0;
        round++;
        currentPhase = PHASE_ENTRY;
        startTime = block.timestamp;
        endTime = lotteryDuration > 0 ? block.timestamp + lotteryDuration : 0;
        uniquePlayerCount = 0;
        emit LotteryReset(round);
    }

    function _safeTransfer(address payable _to, uint256 _amount) private {
        (bool ok,) = _to.call{value: _amount}("");
        if (!ok) revert TransferFailed();
    }

    // ======================== VIEWS ========================
    function getTicketCount(address _p) external view returns (uint256) { return ticketCount[_p]; }

    function getMyTicketIndices(address _p) external view returns (uint256[] memory) {
        uint256 cnt = ticketCount[_p];
        uint256[] memory out = new uint256[](cnt);
        uint256 n = players.length;
        uint256 pos = 0;
        for (uint256 i = 0; i < n; i++) {
            if (players[i] == _p) out[pos++] = i;
            if (pos == cnt) break;
        }
        return out;
    }

    function getPrizePool() external view returns (uint256) { return address(this).balance; }
    function getPlayers() external view returns (address[] memory) { return players; }
    function getUniquePlayerCount() external view returns (uint256) { return uniquePlayerCount; }
    function getTotalTickets() external view returns (uint256) { return players.length; }
    function getCommitProgress() external view returns (uint256 c, uint256 t) { return (totalCommits, players.length); }

    function getConfig() external view returns (
        uint256 _ticketPrice, uint256 _maxPlayers, uint256 _duration,
        uint256 _startTime, uint256 _endTime, uint8 _phase,
        uint256 _totalTickets, uint256 _uniquePlayers, uint256 _prizePool
    ) {
        return (
            ticketPrice, maxPlayers, lotteryDuration,
            startTime, endTime, currentPhase,
            players.length, uniquePlayerCount, address(this).balance
        );
    }

    function hasCommitted(address _p, uint256 _i) external view returns (bool) {
        return ticketCommitments[_key(_p, _i)] != bytes32(0);
    }
}
