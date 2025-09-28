const { ethers } = require("ethers");

async function main() {
    console.log("=== 简单检查奖励问题 ===");
    
    const contractAddress = "0x1820100DF42773B4B1D9983331AD357B412366FB";
    const provider = new ethers.JsonRpcProvider("https://sepolia.drpc.org");
    
    try {
        // 检查合约ETH余额
        const contractBalance = await provider.getBalance(contractAddress);
        console.log("合约ETH余额:", ethers.formatEther(contractBalance), "ETH");
        
        // 检查合约代码
        const code = await provider.getCode(contractAddress);
        console.log("合约代码长度:", code.length);
        console.log("合约是否部署:", code !== "0x");
        
        // 尝试直接调用合约方法
        const CONTRACT_ABI = [
            "function gameCounter() external view returns (uint256)",
            "function getPoolBalance() external view returns (uint256)"
        ];
        
        const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
        
        try {
            const gameCounter = await contract.gameCounter();
            console.log("游戏总数:", gameCounter.toString());
            
            const poolBalance = await contract.getPoolBalance();
            console.log("奖池余额:", ethers.formatEther(poolBalance), "ETH");
            
        } catch (error) {
            console.log("合约调用失败:", error.message);
        }
        
        // 检查最近的交易
        console.log("\n=== 检查最近交易 ===");
        const currentBlock = await provider.getBlockNumber();
        console.log("当前区块:", currentBlock);
        
        // 检查最近几个区块
        for (let i = 0; i < 3; i++) {
            try {
                const block = await provider.getBlock(currentBlock - i, true);
                if (block && block.transactions) {
                    console.log(`\n区块 ${block.number} (${block.transactions.length} 笔交易):`);
                    
                    for (const tx of block.transactions) {
                        if (tx.to && tx.to.toLowerCase() === contractAddress.toLowerCase()) {
                            console.log(`  交易: ${tx.hash}`);
                            console.log(`  发送者: ${tx.from}`);
                            console.log(`  值: ${ethers.formatEther(tx.value)} ETH`);
                            console.log(`  Gas限制: ${tx.gasLimit.toString()}`);
                            
                            try {
                                const receipt = await provider.getTransactionReceipt(tx.hash);
                                console.log(`  状态: ${receipt.status === 1 ? '成功' : '失败'}`);
                                console.log(`  Gas使用: ${receipt.gasUsed.toString()}`);
                                
                                if (receipt.status === 0) {
                                    console.log(`  ❌ 交易失败！`);
                                } else {
                                    console.log(`  ✅ 交易成功`);
                                }
                            } catch (e) {
                                console.log(`  无法获取交易收据`);
                            }
                        }
                    }
                }
            } catch (e) {
                console.log(`无法获取区块 ${currentBlock - i}`);
            }
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
