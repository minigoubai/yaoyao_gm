// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GiwaLotteryV4 {

    uint256 private constant BASIS_POINTS    = 10000;
    uint256 private constant FIRST_PRIZE_BP  = 5000;
    uint256 private constant SECOND_PRIZE_BP = 2500;
    uint256 private constant THIRD_PRIZE_BP  = 1500;
    uint256 private constant MANAGER_FEE_BP  = 1000;

    uint8 private constant PHASE_ENTRY = 0;
    uint8 private constant PHASE_DRAW  = 1;

    error OnlyManager();
    error WrongPhase(uint8 cur, uint8 exp);
    error InsufficientPayment();
    error InvalidConfig();
    error ZeroAddress();
    error NoPlayers();
    error TransferFailed();

    address public immutable MANAGER;

    address public pendingManager;
    uint256 public ticketPrice;
    uint256 public maxPlayers;
    uint256 public lotteryDuration;

    uint8   public currentPhase;
    uint256 public round;
    uint256 public startTime;
    uint256 public endTime;

    address[] public players;
    mapping(address => uint256) public ticketCount;

    event PhaseChanged(uint8 indexed from, uint8 indexed to);
    event TicketsPurchased(address indexed player, uint256 count, uint256 amount, uint256 round);
    event WinnersPicked(address w1, uint256 p1, address w2, uint256 p2, address w3, uint256 p3);
    event LotteryReset(uint256 newRound);
    event ManagerUpdated(address indexed oldMgr, address indexed newMgr);
    event TimerExpired(uint256 endTime);

    modifier onlyManager() { if (msg.sender != MANAGER) revert OnlyManager(); _; }
    modifier atPhase(uint8 _phase) { if (currentPhase != _phase) revert WrongPhase(currentPhase, _phase); _; }

    constructor() {
        MANAGER = msg.sender;
        round = 1;
        currentPhase = PHASE_ENTRY;
        ticketPrice = 0.001 ether;
        startTime = block.timestamp;
    }

    receive() external payable {}

    function _buyTickets(uint256 _count) internal {
        if (_count == 0 || _count > 50) revert InvalidConfig();
        uint256 cost = ticketPrice * _count;
        if (msg.value < cost) revert InsufficientPayment();

        for (uint256 i = 0; i < _count; i++) players.push(msg.sender);
        ticketCount[msg.sender] += _count;

        if (msg.value > cost) _safeTransfer(payable(msg.sender), msg.value - cost);

        emit TicketsPurchased(msg.sender, _count, cost, round);

        if (maxPlayers > 0 && players.length >= maxPlayers) {
            _toDraw();
        }
    }

    function buyTickets(uint256 _count) external payable atPhase(PHASE_ENTRY) {
        _buyTickets(_count);
    }

    function enter() external payable atPhase(PHASE_ENTRY) {
        _buyTickets(1);
    }

    function checkTimerExpiry() external {
        if (endTime == 0) return;
        if (block.timestamp < endTime) return;
        emit TimerExpired(endTime);

        if (currentPhase == PHASE_ENTRY) {
            if (players.length > 0) {
                _toDraw();
            } else {
                endTime = lotteryDuration > 0 ? block.timestamp + lotteryDuration : 0;
            }
        }
    }

    function triggerDraw() external atPhase(PHASE_DRAW) {
        _drawAndDistribute();
    }

    function configure(uint256 _price, uint256 _max, uint256 _dur) external onlyManager {
        if (_price == 0) revert InvalidConfig();
        ticketPrice = _price;
        maxPlayers = _max;
        lotteryDuration = _dur;
        startTime = block.timestamp;
        endTime = _dur > 0 ? block.timestamp + _dur : 0;
    }

    function forceDraw() external onlyManager atPhase(PHASE_DRAW) {
        _drawAndDistribute();
    }

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

    function _toDraw() private {
        emit PhaseChanged(currentPhase, PHASE_DRAW);
        currentPhase = PHASE_DRAW;
    }

    function _drawAndDistribute() private {
        uint256 n = players.length;
        if (n == 0) { _reset(); return; }

        uint256 pool = address(this).balance;
        uint256 fee = (pool * MANAGER_FEE_BP) / BASIS_POINTS;
        uint256 dist = pool - fee;

        bytes32 seed = keccak256(abi.encode(
            players, round, block.timestamp,
            block.coinbase, block.prevrandao,
            block.number, tx.origin
        ));

        uint256[3] memory sel = _pickThree(seed, n);
        address w1 = players[sel[0]];
        address w2 = players[sel[1]];
        address w3 = players[sel[2]];

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
        round++;
        currentPhase = PHASE_ENTRY;
        startTime = block.timestamp;
        endTime = lotteryDuration > 0 ? block.timestamp + lotteryDuration : 0;
        emit LotteryReset(round);
    }

    function _safeTransfer(address payable _to, uint256 _amount) private {
        (bool ok,) = _to.call{value: _amount}("");
        if (!ok) revert TransferFailed();
    }

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
    function getTotalTickets() external view returns (uint256) { return players.length; }

    function getConfig() external view returns (
        uint256 _ticketPrice, uint256 _maxPlayers, uint256 _duration,
        uint256 _startTime, uint256 _endTime, uint8 _phase,
        uint256 _totalTickets, uint256 _prizePool
    ) {
        return (
            ticketPrice, maxPlayers, lotteryDuration,
            startTime, endTime, currentPhase,
            players.length, address(this).balance
        );
    }
}
