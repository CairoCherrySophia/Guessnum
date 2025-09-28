// 合约配置
export const CONTRACT_CONFIG = {
  
  // Sepolia测试网配置（备用）
  SEPOLIA_ADDRESS: "0xcCf02BDCdC642d154a5BaB8F9D17555eC7e701c5",
  SEPOLIA_NETWORK_ID: 11155111,
  SEPOLIA_RPC_URL: "https://ethereum-sepolia-rpc.publicnode.com",
  
  // 默认主地址（用于本地/自定义或 Fhenix 42069）
  // 如已部署，请将下面地址替换为实际合约地址；也可由脚本写入
  ADDRESS: "0x0000000000000000000000000000000000000000",
  
  // 合约ABI（包含FHE功能）
  ABI: [
    // 传统游戏功能
    "function createGuessSizeGame(bool isBig) external payable",
    "function createGuessNumberGame(uint32 number) external payable",
    
    // FHE加密游戏功能
    "function createEncryptedGuessSizeGame(bytes32 encryptedGuess) external payable",
    "function createEncryptedGuessNumberGame(bytes32 encryptedGuess) external payable",
    // 可选管理端处理接口（如需）
    "function processEncryptedGameRequest(uint256 requestId, uint64 decryptedGuess) external",
    "function processEncryptedGameWithFHE(uint256 requestId, bytes32 encryptedResult) external",
    "function processEncryptedGameWithFHE(uint256 requestId, bytes32 encryptedResult, bool decryptedWin) external",
    // 新增：玩家自助结算
    "function revealAndProcessEncryptedGame(uint256 requestId, uint64 decryptedGuess) external",
    
    // 查询功能
    "function getPoolBalance() external view returns (uint256)",
    "function getPlatformRevenue() external view returns (uint256)",
    "function getPlayerGames(address player) external view returns (uint256[])",
    "function getGame(uint256 gameId) external view returns (tuple(uint256 gameId, address player, uint8 gameType, uint256 betAmount, uint32 guess, uint32 result, uint8 status, uint256 timestamp, uint256 reward))",
    "function getEncryptedRequest(uint256 requestId) external view returns (tuple(uint256 requestId, address player, uint8 gameType, uint256 betAmount, bytes encryptedGuess, uint256 timestamp, bool processed, uint256 reward))",
    "function getPendingRequests(address player) external view returns (uint256[])",
    "function config() external view returns (tuple(uint256 minBet, uint256 maxBet, uint256 platformFeePercent, uint256 houseEdgePercent))",
    
    // 事件
    "event GameCreated(uint256 indexed gameId, address indexed player, uint8 gameType, uint256 betAmount)",
    "event GameResult(uint256 indexed gameId, address indexed player, bool won, uint256 reward)",
    "event EncryptedGameRequested(uint256 indexed requestId, address indexed player, uint8 gameType, uint256 betAmount)",
    "event EncryptedGameProcessed(uint256 indexed requestId, address indexed player, bool won, uint256 reward)",
    "event PoolUpdated(uint256 newPoolAmount)",
    "event ConfigUpdated(uint256 minBet, uint256 maxBet, uint256 platformFeePercent)"
  ]
};

export default CONTRACT_CONFIG;
