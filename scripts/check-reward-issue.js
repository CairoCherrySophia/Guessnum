const { ethers } = require("ethers");

async function main() {
    console.log("=== 检查奖励发放问题 ===");
    
    const contractAddress = "0x1820100DF42773B4B1D9983331AD357B412366FB";
    const provider = new ethers.JsonRpcProvider("https://sepolia.drpc.org");
    
    // 简化的ABI
    const CONTRACT_ABI = [
        "function getGame(uint256 gameId) external view returns (tuple(uint256 gameId, address player, uint8 gameType, uint256 betAmount, uint32 guess, uint32 result, uint8 status, uint256 timestamp, uint256 reward))",
        "function gameCounter() external view returns (uint256)",
        "function getPoolBalance() external view returns (uint256)"
    ];
    
    const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
    
    try {
        const gameCounter = await contract.gameCounter();
        const poolBalance = await contract.getPoolBalance();
        
        console.log("当前奖池余额:", ethers.formatEther(poolBalance), "ETH");
        console.log("总游戏数:", gameCounter.toString());
        
        console.log("\n=== 分析获胜游戏 ===");
        
        let wonGames = 0;
        let totalReward = 0;
        
        // 检查所有游戏记录
        for (let i = 1; i <= Number(gameCounter); i++) {
            const game = await contract.getGame(i);
            
            if (game.status === 1) { // 获胜游戏
                wonGames++;
                totalReward += Number(ethers.formatEther(game.reward));
                
                console.log(`\n获胜游戏 #${i}:`);
                console.log(`  类型: ${game.gameType === 0 ? "猜大小" : "猜数字"}`);
                console.log(`  下注: ${ethers.formatEther(game.betAmount)} ETH`);
                console.log(`  猜测: ${game.guess} ${game.gameType === 0 ? (game.guess === 1 ? "(猜大)" : "(猜小)") : ""}`);
                console.log(`  结果: ${game.result}`);
                console.log(`  奖励: ${ethers.formatEther(game.reward)} ETH`);
                console.log(`  时间: ${new Date(Number(game.timestamp) * 1000).toLocaleString()}`);
                
                // 分析奖励计算
                let expectedReward = 0;
                if (game.gameType === 0) { // 猜大小
                    expectedReward = Number(ethers.formatEther(game.betAmount)) * 2; // 1:1赔率
                } else { // 猜数字
                    expectedReward = Number(ethers.formatEther(game.betAmount)) * 6; // 1:5赔率
                }
                
                console.log(`  预期奖励: ${expectedReward} ETH`);
                console.log(`  实际奖励: ${ethers.formatEther(game.reward)} ETH`);
                console.log(`  奖励正确: ${Math.abs(expectedReward - Number(ethers.formatEther(game.reward))) < 0.0001 ? '✅' : '❌'}`);
            }
        }
        
        console.log(`\n=== 总结 ===`);
        console.log(`获胜游戏数: ${wonGames}`);
        console.log(`总奖励金额: ${totalReward} ETH`);
        console.log(`当前奖池: ${ethers.formatEther(poolBalance)} ETH`);
        
        if (wonGames === 0) {
            console.log("\n❌ 没有找到获胜的游戏！");
            console.log("可能的原因：");
            console.log("1. 您还没有获胜过");
            console.log("2. 游戏状态更新有问题");
            console.log("3. 需要重新检查游戏记录");
        } else {
            console.log("\n✅ 找到获胜游戏，但奖励可能没有正确发放");
            console.log("可能的问题：");
            console.log("1. 转账失败但没有抛出异常");
            console.log("2. Gas不足导致转账失败");
            console.log("3. 合约中的转账逻辑有问题");
        }
        
        // 检查最近的交易
        console.log("\n=== 检查最近交易 ===");
        try {
            const currentBlock = await provider.getBlockNumber();
            console.log("当前区块:", currentBlock);
            
            // 检查最近几个区块中与合约相关的交易
            for (let i = 0; i < 5; i++) {
                const block = await provider.getBlock(currentBlock - i, true);
                if (block && block.transactions) {
                    for (const tx of block.transactions) {
                        if (tx.to && tx.to.toLowerCase() === contractAddress.toLowerCase()) {
                            console.log(`\n区块 ${block.number}: 交易 ${tx.hash}`);
                            try {
                                const receipt = await provider.getTransactionReceipt(tx.hash);
                                console.log(`  状态: ${receipt.status === 1 ? '成功' : '失败'}`);
                                console.log(`  Gas使用: ${receipt.gasUsed.toString()}`);
                                console.log(`  Gas限制: ${tx.gasLimit.toString()}`);
                                
                                // 检查是否有转账
                                if (receipt.logs && receipt.logs.length > 0) {
                                    console.log(`  事件数量: ${receipt.logs.length}`);
                                }
                            } catch (e) {
                                console.log(`  无法获取交易详情`);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.log("无法获取交易历史");
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
