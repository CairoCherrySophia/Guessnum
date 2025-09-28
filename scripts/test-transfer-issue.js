const { ethers } = require("ethers");

async function main() {
    console.log("=== 测试转账问题 ===");
    
    const contractAddress = "0x1820100DF42773B4B1D9983331AD357B412366FB";
    const provider = new ethers.JsonRpcProvider("https://sepolia.drpc.org");
    
    // 完整的合约ABI
    const CONTRACT_ABI = [
        "function getGame(uint256 gameId) external view returns (tuple(uint256 gameId, address player, uint8 gameType, uint256 betAmount, uint32 guess, uint32 result, uint8 status, uint256 timestamp, uint256 reward))",
        "function gameCounter() external view returns (uint256)",
        "function getPoolBalance() external view returns (uint256)",
        "function createGuessSizeGame(bool isBig) external payable",
        "function createGuessNumberGame(uint32 number) external payable"
    ];
    
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
    
    try {
        const gameCounter = await contract.gameCounter();
        console.log("总游戏数:", gameCounter.toString());
        
        // 检查所有游戏，找出获胜的游戏
        let wonGames = [];
        for (let i = 1; i <= Number(gameCounter); i++) {
            try {
                const game = await contract.getGame(i);
                if (game.status === 1) { // 获胜
                    wonGames.push({ id: i, game });
                }
            } catch (e) {
                console.log(`无法获取游戏 #${i}:`, e.message);
            }
        }
        
        console.log(`\n找到 ${wonGames.length} 个获胜游戏`);
        
        if (wonGames.length > 0) {
            for (const { id, game } of wonGames) {
                console.log(`\n获胜游戏 #${id}:`);
                console.log(`  玩家: ${game.player}`);
                console.log(`  类型: ${game.gameType === 0 ? "猜大小" : "猜数字"}`);
                console.log(`  下注: ${ethers.formatEther(game.betAmount)} ETH`);
                console.log(`  奖励: ${ethers.formatEther(game.reward)} ETH`);
                console.log(`  时间: ${new Date(Number(game.timestamp) * 1000).toLocaleString()}`);
                
                // 检查玩家当前余额
                try {
                    const playerBalance = await provider.getBalance(game.player);
                    console.log(`  玩家当前余额: ${ethers.formatEther(playerBalance)} ETH`);
                } catch (e) {
                    console.log(`  无法获取玩家余额`);
                }
            }
        } else {
            console.log("\n❌ 没有找到获胜的游戏");
            console.log("可能的原因：");
            console.log("1. 您还没有获胜过");
            console.log("2. 游戏状态更新有问题");
            console.log("3. 需要重新检查游戏记录");
            
            // 显示所有游戏状态
            console.log("\n所有游戏状态：");
            for (let i = 1; i <= Number(gameCounter); i++) {
                try {
                    const game = await contract.getGame(i);
                    console.log(`游戏 #${i}: 状态=${game.status} (0=进行中, 1=获胜, 2=失败), 奖励=${ethers.formatEther(game.reward)} ETH`);
                } catch (e) {
                    console.log(`游戏 #${i}: 无法获取`);
                }
            }
        }
        
        // 分析可能的问题
        console.log("\n=== 问题分析 ===");
        console.log("可能的问题：");
        console.log("1. 合约中的 transfer() 函数可能失败");
        console.log("2. Gas 不足导致转账失败");
        console.log("3. 合约余额不足");
        console.log("4. 转账被拒绝");
        
        console.log("\n建议的解决方案：");
        console.log("1. 检查合约是否使用 transfer() 而不是 call()");
        console.log("2. 增加 Gas 限制");
        console.log("3. 确保合约有足够余额");
        console.log("4. 使用更安全的转账方式");
        
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
