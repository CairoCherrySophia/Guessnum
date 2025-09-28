// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import {FHE, euint64, ebool, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
// import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {SepoliaConfig} from "./config/ZamaConfig.sol";

/**
 * @title NumberGuessGame
 * @dev 基于FHEVM的猜数字游戏合约，支持加密计算
 */
contract NumberGuessGame is SepoliaConfig, ReentrancyGuard, Ownable, Pausable {
    // 游戏状态枚举
    enum GameType { GuessSize, GuessNumber }
    
    // 游戏结果枚举
    enum GameStatus { Pending, Won, Lost }

    // 游戏记录结构（只保留非敏感字段，敏感数据均走密文存储）
    struct GameRecord {
        uint256 gameId;
        address player;
        GameType gameType;
        uint256 timestamp;
    }

    // FHE加密结算/回调请求
    struct PayoutRequest {
        address player;
        uint256 gameId;
        uint256 timestamp;
    }

    // 游戏配置
    struct GameConfig {
        uint256 minBet;
        uint256 maxBet;
        uint256 platformFeePercent; // 平台手续费百分比
        uint256 houseEdgePercent; // 庄家优势百分比
    }

    // 状态变量（明文视图 + FHE密文）
    mapping(uint256 => GameRecord) private games;
    mapping(address => uint256[]) public playerGames;
    mapping(address => uint256) public playerStats;
    
    // FHE：按游戏存储的密文数据
    mapping(uint256 => euint64) private _eBetByGame;
    mapping(uint256 => euint64) private _eGuessByGame;
    mapping(uint256 => euint64) private _eResultByGame;
    mapping(uint256 => euint64) private _eRewardByGame;
    mapping(uint256 => ebool) private _eWinByGame;

    // FHE：合约内账（以 wei 计）
    euint64 private _encryptedTotalPool; // 奖池（密文）
    euint64 private _encryptedPlatformRevenue; // 平台收入（密文）

    // 解密回调请求
    mapping(uint256 => PayoutRequest) private _payoutRequests;
    uint256 public requestCounter;
    
    uint256 public gameCounter;
    uint256 public totalPool; // 已弃用：不再维护明文镜像，仅为向后兼容，恒为0
    uint256 public platformRevenue; // 已弃用：不再维护明文镜像，仅为向后兼容，恒为0
    
    GameConfig public config;
    
    // 事件
    event GameCreated(uint256 indexed gameId, address indexed player, GameType gameType);
    event GameResult(uint256 indexed gameId, address indexed player);
    event PoolUpdated();
    event ConfigUpdated(uint256 minBet, uint256 maxBet, uint256 platformFeePercent);
    
    // FHE相关事件
    event PayoutDecryptionRequested(uint256 indexed requestId, uint256 indexed gameId, address indexed player);
    event PayoutCompleted(uint256 indexed gameId, address indexed player, uint256 amount);

    constructor() Ownable(msg.sender) {
        // 初始化游戏配置
        config = GameConfig({
            minBet: 0.0001 ether, // 最小下注 0.0001 ETH
            maxBet: 1 ether,     // 最大下注 1 ETH
            platformFeePercent: 2, // 2% 平台手续费
            houseEdgePercent: 5   // 5% 庄家优势
        });

        // 初始化FHE账本
        _encryptedTotalPool = FHE.asEuint64(0);
        _encryptedPlatformRevenue = FHE.asEuint64(0);
        _authorizeHandle(_encryptedTotalPool);
        _authorizeHandle(_encryptedPlatformRevenue);
        totalPool = 0;
        platformRevenue = 0;
    }

    // ----------------------
    // 内部工具：授权密文访问
    // ----------------------
    function _authorizeHandle(euint64 handle) private {
        FHE.allowThis(handle);
        FHE.allow(handle, msg.sender);
    }

    function _authorizeHandle(ebool handle) private {
        FHE.allowThis(handle);
        FHE.allow(handle, msg.sender);
    }

    /**
     * @dev 创建猜大小游戏（已禁用，使用加密接口）
     */
    function createGuessSizeGame(bool /*isBig*/ ) external payable whenNotPaused nonReentrant {
        revert("Use FHE interface createEncryptedGuessSizeGame");
    }

    /**
     * @dev 创建猜数字游戏（已禁用，使用加密接口）
     */
    function createGuessNumberGame(uint32 /*number*/ ) external payable whenNotPaused nonReentrant {
        revert("Use FHE interface createEncryptedGuessNumberGame");
    }

    /**
     * @dev 生成随机数（1-6）
     */
    function _generateRandomNumber() internal view returns (uint32) {
        // 使用区块信息生成伪随机数
        uint256 randomSeed = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            block.coinbase,
            msg.sender,
            gameCounter
        )));
        
        // 生成1-6之间的随机数
        return uint32((randomSeed % 6) + 1);
    }

    /**
     * @dev 检查猜大小结果
     */
    function _checkGuessSizeResult(bool isBig, uint32 result) internal pure returns (bool) {
        // 如果猜大，则结果>3时获胜
        // 如果猜小，则结果<=3时获胜
        return isBig ? (result > 3) : (result <= 3);
    }

    /**
     * @dev 检查猜数字结果
     */
    function _checkGuessNumberResult(uint32 guess, uint32 result) internal pure returns (bool) {
        return guess == result;
    }

    /**
     * @dev 获取玩家游戏记录
     */
    function getPlayerGames(address player) external view returns (uint256[] memory) {
        return playerGames[player];
    }

    /**
     * @dev 获取游戏详情
     */
    function getGame(uint256 gameId) external view returns (GameRecord memory) {
        return games[gameId];
    }

    /**
     * @dev 获取奖池余额
     */
    function getPoolBalance() external view returns (uint256) {
        return 0; // 明文镜像已弃用
    }

    /**
     * @dev 获取加密奖池（密文）
     */
    function getEncryptedPool() external view returns (euint64) {
        return _encryptedTotalPool;
    }

    /**
     * @dev 获取平台收入
     */
    function getPlatformRevenue() external view returns (uint256) {
        return 0; // 明文镜像已弃用
    }

    /**
     * @dev 管理员：补充奖池
     */
    function addToPool() external payable onlyOwner {
        require(msg.value <= type(uint64).max, "Amount too large for FHE");
        _encryptedTotalPool = FHE.add(_encryptedTotalPool, FHE.asEuint64(uint64(msg.value)));
        _authorizeHandle(_encryptedTotalPool);
        emit PoolUpdated();
    }

    /**
     * @dev 管理员：提取平台收入
     */
    function withdrawPlatformRevenue() external onlyOwner {
        // 通过解密平台收入密文，回调后完成提现
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(_encryptedPlatformRevenue);
        uint256 reqId = FHE.requestDecryption(cts, this.callbackWithdrawRevenue.selector);
        emit PayoutDecryptionRequested(reqId, 0, owner());
    }

    /**
     * @dev 管理员：更新游戏配置
     */
    function updateConfig(
        uint256 _minBet,
        uint256 _maxBet,
        uint256 _platformFeePercent,
        uint256 _houseEdgePercent
    ) external onlyOwner {
        config.minBet = _minBet;
        config.maxBet = _maxBet;
        config.platformFeePercent = _platformFeePercent;
        config.houseEdgePercent = _houseEdgePercent;
        
        emit ConfigUpdated(_minBet, _maxBet, _platformFeePercent);
    }

    /**
     * @dev 管理员：暂停游戏
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev 管理员：恢复游戏
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev 接收ETH
     */
    receive() external payable {
        require(msg.value <= type(uint64).max, "Amount too large for FHE");
        _encryptedTotalPool = FHE.add(_encryptedTotalPool, FHE.asEuint64(uint64(msg.value)));
        _authorizeHandle(_encryptedTotalPool);
        emit PoolUpdated();
    }

    // ========== FHE加密游戏接口 ==========
    
    /**
     * @dev FHE版本：创建加密猜大小游戏（外部密文+证明）
     */
    function createEncryptedGuessSizeGame(externalEuint64 _encryptedGuess, bytes calldata proof) external payable whenNotPaused nonReentrant {
        require(msg.value >= config.minBet && msg.value <= config.maxBet, "Bet amount out of range");
        require(msg.value <= type(uint64).max, "Bet too large for FHE");
        
        uint256 gameId = ++gameCounter;
        
        games[gameId] = GameRecord({
            gameId: gameId,
            player: msg.sender,
            gameType: GameType.GuessSize,
            timestamp: block.timestamp
        });
        playerGames[msg.sender].push(gameId);
        
        euint64 guess = FHE.fromExternal(_encryptedGuess, proof);
        _authorizeHandle(guess);
        _processGameFHE(GameType.GuessSize, guess, uint64(msg.value), gameId, msg.sender);
        
        emit GameCreated(gameId, msg.sender, GameType.GuessSize);
    }

    /**
     * @dev FHE版本：创建加密猜数字游戏（外部密文+证明）
     */
    function createEncryptedGuessNumberGame(externalEuint64 _encryptedGuess, bytes calldata proof) external payable whenNotPaused nonReentrant {
        require(msg.value >= config.minBet && msg.value <= config.maxBet, "Bet amount out of range");
        require(msg.value <= type(uint64).max, "Bet too large for FHE");
        
        uint256 gameId = ++gameCounter;
        
        games[gameId] = GameRecord({
            gameId: gameId,
            player: msg.sender,
            gameType: GameType.GuessNumber,
            timestamp: block.timestamp
        });
        playerGames[msg.sender].push(gameId);
        
        euint64 guess = FHE.fromExternal(_encryptedGuess, proof);
        _authorizeHandle(guess);
        _processGameFHE(GameType.GuessNumber, guess, uint64(msg.value), gameId, msg.sender);
        
        emit GameCreated(gameId, msg.sender, GameType.GuessNumber);
    }

    // 明文结算路径已移除

    /**
     * @dev FHE比较：猜大小游戏（使用FHE API）
     * @param encryptedGuess 加密的猜测值
     * @param encryptedResult 加密的结果
     * @return 加密的布尔值，表示是否获胜
     */
    function _compareEncryptedGuessSize(euint64 encryptedGuess, euint64 encryptedResult) internal returns (ebool) {
        // 使用FHE API进行加密比较
        // 猜大小：如果猜大(1)，则结果>3时获胜；如果猜小(0)，则结果<=3时获胜
        
        // 创建常量3的加密版本
        euint64 constant3 = FHE.asEuint64(3);
        
        // 检查结果是否大于3
        ebool resultIsBig = FHE.gt(encryptedResult, constant3);
        
        // 如果猜测是1（大），则获胜条件为结果>3
        // 如果猜测是0（小），则获胜条件为结果<=3
        ebool guessIsBig = FHE.eq(encryptedGuess, FHE.asEuint64(1));
        
        // 使用条件逻辑：如果猜大且结果大，或者猜小且结果小，则获胜
        ebool bigWin = FHE.and(guessIsBig, resultIsBig);
        ebool smallWin = FHE.and(FHE.not(guessIsBig), FHE.not(resultIsBig));
        
        return FHE.or(bigWin, smallWin);
    }

    /**
     * @dev FHE比较：猜数字游戏（使用FHE API）
     * @param encryptedGuess 加密的猜测值
     * @param encryptedResult 加密的结果
     * @return 加密的布尔值，表示是否获胜
     */
    function _compareEncryptedGuessNumber(euint64 encryptedGuess, euint64 encryptedResult) internal returns (ebool) {
        // 使用FHE API进行加密比较
        // 猜数字：猜测值必须等于结果值
        return FHE.eq(encryptedGuess, encryptedResult);
    }

    // ----------------------
    // 内部：FHE路径处理 + 异步解密回调发奖
    // ----------------------
    function _processGameFHE(
        GameType gameType,
        euint64 eGuess,
        uint64 betWei,
        uint256 gameId,
        address player
    ) internal {
        // 保存密文下注与猜测
        _eBetByGame[gameId] = FHE.asEuint64(betWei);
        _eGuessByGame[gameId] = eGuess;
        _authorizeHandle(_eBetByGame[gameId]);
        _authorizeHandle(_eGuessByGame[gameId]);

        // 生成明文结果并转密文
        uint32 resultPlain = _generateRandomNumber();
        euint64 eResult = FHE.asEuint64(resultPlain);
        _eResultByGame[gameId] = eResult;
        _authorizeHandle(_eResultByGame[gameId]);

        // 计算是否获胜（密文）
        ebool eWin;
        if (gameType == GameType.GuessSize) {
            eWin = _compareEncryptedGuessSize(eGuess, eResult);
        } else {
            eWin = _compareEncryptedGuessNumber(eGuess, eResult);
        }
        _eWinByGame[gameId] = eWin;
        _authorizeHandle(_eWinByGame[gameId]);

        // 计算平台费与庄家优势（密文）
        euint64 fee = FHE.div(
            FHE.mul(_eBetByGame[gameId], FHE.asEuint64(uint64(config.platformFeePercent))),
            uint64(100)
        );
        euint64 edge = FHE.div(
            FHE.mul(_eBetByGame[gameId], FHE.asEuint64(uint64(config.houseEdgePercent))),
            uint64(100)
        );

        // 倍率与奖励（密文）
        euint64 multiplier = (gameType == GameType.GuessSize) ? FHE.asEuint64(2) : FHE.asEuint64(6);
        euint64 rewardCandidate = FHE.mul(_eBetByGame[gameId], multiplier);
        euint64 eReward = FHE.select(eWin, rewardCandidate, FHE.asEuint64(0));
        _eRewardByGame[gameId] = eReward;
        _authorizeHandle(_eRewardByGame[gameId]);

        // 更新密文账本（池与平台收入）
        // 输：池 += bet - fee - edge， 收入 += fee
        // 赢：池 -= reward， 收入不变
        euint64 poolLose = FHE.add(_encryptedTotalPool, FHE.sub(FHE.sub(_eBetByGame[gameId], fee), edge));
        euint64 poolWin = FHE.sub(_encryptedTotalPool, rewardCandidate);
        _encryptedTotalPool = FHE.select(eWin, poolWin, poolLose);
        _authorizeHandle(_encryptedTotalPool);

        euint64 revenueLose = FHE.add(_encryptedPlatformRevenue, fee);
        _encryptedPlatformRevenue = FHE.select(eWin, _encryptedPlatformRevenue, revenueLose);
        _authorizeHandle(_encryptedPlatformRevenue);

        // 记录 payout 解密请求
        _requestPayoutDecryption(eReward, gameId, player);

        // 同步更新明文镜像：此处仅在输的情况下可以安全累计到奖池与平台收入
        // 赢的情况下在回调中扣减并付款
        // 注意：此处无法明文判定输赢，留待回调完成
        // 为保持向后兼容，先累加下注到合约余额，不更新 totalPool/platformRevenue，待回调确认再更新。
    }

    function _requestPayoutDecryption(euint64 eReward, uint256 gameId, address player) internal {
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(eReward);
        uint256 reqId = FHE.requestDecryption(cts, this.callbackPayout.selector);
        _payoutRequests[reqId] = PayoutRequest({player: player, gameId: gameId, timestamp: block.timestamp});
        requestCounter = reqId;
        emit PayoutDecryptionRequested(reqId, gameId, player);
    }

    /**
     * @dev 解密回调：发放奖励并更新明文镜像
     */
    function callbackPayout(uint256 requestId, uint64 rewardWei, bytes[] memory signatures) external {
        // 验证签名
        // FHE.checkSignatures expects (requestId, cleartexts, proof). Here we don't have cleartexts bytes; use empty bytes for cleartexts.
        bytes memory empty;
        bytes memory proof;
        if (signatures.length > 0) {
            proof = signatures[0];
        }
        FHE.checkSignatures(requestId, empty, proof);
        PayoutRequest memory pr = _payoutRequests[requestId];
        require(pr.player != address(0), "Invalid request");

        uint256 gameId = pr.gameId;
        address player = pr.player;

        // 根据是否有奖励判断输赢
        bool isWin = rewardWei > 0;
                
                if (isWin) {
            // 直接转账给玩家（合约需有足够ETH余额）
            payable(player).transfer(rewardWei);
                } else {
            // no-op for loss
        }

        emit GameResult(gameId, player);
        emit PoolUpdated();
        emit PayoutCompleted(gameId, player, rewardWei);

        // 清理
        delete _payoutRequests[requestId];
    }

    /**
     * @dev 解密回调：提现平台收入
     */
    function callbackWithdrawRevenue(uint256 requestId, uint64 revenueWei, bytes[] memory signatures) external {
        // 验证签名
        bytes memory empty;
        bytes memory proof;
        if (signatures.length > 0) {
            proof = signatures[0];
        }
        FHE.checkSignatures(requestId, empty, proof);
        // 将平台收入密文清零并提现给owner
        if (revenueWei > 0) {
            // 清零密文收入
            _encryptedPlatformRevenue = FHE.sub(_encryptedPlatformRevenue, FHE.asEuint64(revenueWei));
            _authorizeHandle(_encryptedPlatformRevenue);
            // 转账
            payable(owner()).transfer(revenueWei);
        }
        emit PoolUpdated();
    }

    /**
     * @dev 获取合约的FHE状态信息
     * @return totalRequests 总请求数
     * @return pendingCount 待处理请求数
     * @return processedCount 已处理请求数
     */
    function getFHEStatus() external view returns (uint256 totalRequests, uint256 pendingCount, uint256 processedCount) {
        // 简化：仅返回已分配的最新请求号，无法逐个统计状态（请求被处理后即删除）
        totalRequests = requestCounter;
        pendingCount = 0;
        processedCount = 0;
    }

    /**
     * @dev 获取某局的加密数据
     */
    function getEncryptedGameData(uint256 gameId)
        external
        view
        returns (euint64 eBet, euint64 eGuess, euint64 eResult, ebool eWin, euint64 eReward)
    {
        return (_eBetByGame[gameId], _eGuessByGame[gameId], _eResultByGame[gameId], _eWinByGame[gameId], _eRewardByGame[gameId]);
    }

    /**
     * @dev 紧急停止：暂停所有FHE游戏
     */
    function emergencyPauseFHE() external onlyOwner {
        _pause();
    }

}