const { ethers } = require("ethers");

// 合约ABI
const CONTRACT_ABI = [
  "function getGame(uint256 gameId) external view returns (tuple(uint256 gameId, address player, uint8 gameType, uint256 betAmount, uint32 guess, uint32 result, uint8 status, uint256 timestamp, uint256 reward))",
  "function getPlayerGames(address player) external view returns (uint256[])",
  "function gameCounter() external view returns (uint256)"
];

async function main() {
  const contractAddress = "0x1820100DF42773B4B1D9983331AD357B412366FB";
  const provider = new ethers.JsonRpcProvider("https://sepolia.drpc.org");
  const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
  
  console.log("=== 游戏记录检查 ===");
  
  try {
    const gameCounter = await contract.gameCounter();
    console.log("总游戏数:", gameCounter.toString());
    
    // 检查所有游戏记录
    for (let i = 1; i <= Number(gameCounter); i++) {
      try {
        const game = await contract.getGame(i);
        console.log(`\n游戏 #${i}:`);
        console.log(`  玩家: ${game.player}`);
        console.log(`  游戏类型: ${game.gameType === 0 ? "猜大小" : "猜数字"}`);
        console.log(`  下注金额: ${ethers.formatEther(game.betAmount)} ETH`);
        console.log(`  猜测: ${game.guess}`);
        console.log(`  结果: ${game.result}`);
        console.log(`  状态: ${game.status === 0 ? "进行中" : game.status === 1 ? "获胜" : "失败"}`);
        console.log(`  奖励: ${ethers.formatEther(game.reward)} ETH`);
        console.log(`  时间戳: ${new Date(Number(game.timestamp) * 1000).toLocaleString()}`);
        
        // 分析问题
        if (game.status === 1) { // 获胜
          console.log(`  ✅ 游戏获胜，应该获得 ${ethers.formatEther(game.reward)} ETH 奖励`);
        } else if (game.status === 2) { // 失败
          console.log(`  ❌ 游戏失败，无奖励`);
        }
      } catch (e) {
        console.log(`游戏 #${i}: 无法获取详情 - ${e.message}`);
      }
    }
    
  } catch (error) {
    console.error("检查游戏记录失败:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("检查失败:", error);
    process.exit(1);
  });
