const { ethers } = require("ethers");

// 合约ABI（简化版，只包含我们需要的方法）
const CONTRACT_ABI = [
  "function config() external view returns (tuple(uint256 minBet, uint256 maxBet, uint256 platformFeePercent, uint256 houseEdgePercent))",
  "function getPoolBalance() external view returns (uint256)",
  "function getPlatformRevenue() external view returns (uint256)",
  "function gameCounter() external view returns (uint256)",
  "function paused() external view returns (bool)",
  "function owner() external view returns (address)",
  "function getGame(uint256 gameId) external view returns (tuple(uint256 gameId, address player, uint8 gameType, uint256 betAmount, uint32 guess, uint32 result, uint8 status, uint256 timestamp, uint256 reward))",
  "function getPlayerGames(address player) external view returns (uint256[])",
  "event GameCreated(uint256 indexed gameId, address indexed player, uint8 gameType, uint256 betAmount)",
  "event GameResult(uint256 indexed gameId, address indexed player, bool won, uint256 reward)"
];

async function main() {
  const contractAddress = "0x1820100DF42773B4B1D9983331AD357B412366FB";
  
  // 使用公共RPC端点
  const provider = new ethers.JsonRpcProvider("https://sepolia.drpc.org");
  const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
  
  console.log("=== 详细合约状态检查 ===");
  console.log("合约地址:", contractAddress);
  console.log("网络: Sepolia测试网\n");

  try {
    // 检查合约ETH余额
    const contractBalance = await provider.getBalance(contractAddress);
    console.log("合约ETH余额:", ethers.formatEther(contractBalance), "ETH");

    // 获取合约配置
    const config = await contract.config();
    console.log("\n=== 游戏配置 ===");
    console.log("最小下注:", ethers.formatEther(config.minBet), "ETH");
    console.log("最大下注:", ethers.formatEther(config.maxBet), "ETH");
    console.log("平台手续费:", config.platformFeePercent.toString(), "%");
    console.log("庄家优势:", config.houseEdgePercent.toString(), "%");

    // 获取奖池和平台收入
    const poolBalance = await contract.getPoolBalance();
    const platformRevenue = await contract.getPlatformRevenue();
    console.log("\n=== 资金状态 ===");
    console.log("奖池余额:", ethers.formatEther(poolBalance), "ETH");
    console.log("平台收入:", ethers.formatEther(platformRevenue), "ETH");

    // 检查合约状态
    const isPaused = await contract.paused();
    const owner = await contract.owner();
    const gameCounter = await contract.gameCounter();
    
    console.log("\n=== 合约状态 ===");
    console.log("是否暂停:", isPaused);
    console.log("合约所有者:", owner);
    console.log("游戏总数:", gameCounter.toString());

    // 分析问题
    console.log("\n=== 问题分析 ===");
    
    if (poolBalance === 0n) {
      console.log("❌ 问题发现：奖池余额为0！");
      console.log("   这是导致奖励无法支付的主要原因。");
      console.log("   需要向奖池添加资金才能支付奖励。");
    } else {
      console.log("✅ 奖池有余额，可以支付奖励");
    }

    if (isPaused) {
      console.log("❌ 合约已暂停，无法进行游戏");
    } else {
      console.log("✅ 合约正常运行");
    }

    // 检查最近几笔交易
    console.log("\n=== 最近交易检查 ===");
    try {
      const currentBlock = await provider.getBlockNumber();
      console.log("当前区块:", currentBlock);
      
      // 获取最近10个区块的交易
      for (let i = 0; i < 10; i++) {
        const block = await provider.getBlock(currentBlock - i, true);
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            if (tx.to && tx.to.toLowerCase() === contractAddress.toLowerCase()) {
              console.log(`区块 ${block.number}: 交易 ${tx.hash}`);
              try {
                const receipt = await provider.getTransactionReceipt(tx.hash);
                if (receipt.status === 1) {
                  console.log(`  ✅ 交易成功，Gas使用: ${receipt.gasUsed}`);
                } else {
                  console.log(`  ❌ 交易失败`);
                }
              } catch (e) {
                console.log(`  ⚠️  无法获取交易详情`);
              }
            }
          }
        }
      }
    } catch (e) {
      console.log("无法获取交易历史:", e.message);
    }

  } catch (error) {
    console.error("检查失败:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("检查失败:", error);
    process.exit(1);
  });
