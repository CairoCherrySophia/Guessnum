const { ethers } = require("ethers");

async function main() {
    console.log("=== 调试交易问题 ===");
    
    const contractAddress = "0x1820100DF42773B4B1D9983331AD357B412366FB";
    const provider = new ethers.JsonRpcProvider("https://sepolia.drpc.org");
    
    try {
        // 检查最近的交易
        const currentBlock = await provider.getBlockNumber();
        console.log("当前区块:", currentBlock);
        
        // 检查最近几个区块中与合约相关的交易
        for (let i = 0; i < 5; i++) {
            const block = await provider.getBlock(currentBlock - i, true);
            if (block && block.transactions) {
                console.log(`\n区块 ${block.number} (${block.transactions.length} 笔交易):`);
                
                for (const tx of block.transactions) {
                    if (tx.to && tx.to.toLowerCase() === contractAddress.toLowerCase()) {
                        console.log(`\n  交易: ${tx.hash}`);
                        console.log(`  发送者: ${tx.from}`);
                        console.log(`  值: ${ethers.formatEther(tx.value)} ETH`);
                        console.log(`  Gas限制: ${tx.gasLimit.toString()}`);
                        console.log(`  数据长度: ${tx.data.length}`);
                        
                        try {
                            const receipt = await provider.getTransactionReceipt(tx.hash);
                            console.log(`  状态: ${receipt.status === 1 ? '成功' : '失败'}`);
                            console.log(`  Gas使用: ${receipt.gasUsed.toString()}`);
                            
                            // 检查交易类型
                            if (tx.value > 0) {
                                console.log(`  📤 发送ETH: ${ethers.formatEther(tx.value)} ETH`);
                            } else {
                                console.log(`  📥 接收ETH: 0 ETH`);
                            }
                            
                            // 检查事件日志
                            if (receipt.logs && receipt.logs.length > 0) {
                                console.log(`  事件数量: ${receipt.logs.length}`);
                                
                                // 尝试解析事件
                                const CONTRACT_ABI = [
                                    "event GameCreated(uint256 indexed gameId, address indexed player, uint8 gameType, uint256 betAmount)",
                                    "event GameResult(uint256 indexed gameId, address indexed player, bool won, uint256 reward)",
                                    "event PoolUpdated(uint256 newPoolAmount)"
                                ];
                                
                                const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
                                
                                for (const log of receipt.logs) {
                                    try {
                                        const parsed = contract.interface.parseLog(log);
                                        if (parsed) {
                                            console.log(`    事件: ${parsed.name}`);
                                            if (parsed.name === 'GameCreated') {
                                                console.log(`      游戏ID: ${parsed.args.gameId.toString()}`);
                                                console.log(`      玩家: ${parsed.args.player}`);
                                                console.log(`      游戏类型: ${parsed.args.gameType === 0 ? '猜大小' : '猜数字'}`);
                                                console.log(`      下注: ${ethers.formatEther(parsed.args.betAmount)} ETH`);
                                            } else if (parsed.name === 'GameResult') {
                                                console.log(`      游戏ID: ${parsed.args.gameId.toString()}`);
                                                console.log(`      玩家: ${parsed.args.player}`);
                                                console.log(`      获胜: ${parsed.args.won}`);
                                                console.log(`      奖励: ${ethers.formatEther(parsed.args.reward)} ETH`);
                                            } else if (parsed.name === 'PoolUpdated') {
                                                console.log(`      新奖池: ${ethers.formatEther(parsed.args.newPoolAmount)} ETH`);
                                            }
                                        }
                                    } catch (e) {
                                        // 忽略解析错误
                                    }
                                }
                            }
                            
                        } catch (e) {
                            console.log(`  无法获取交易收据: ${e.message}`);
                        }
                    }
                }
            }
        }
        
    } catch (error) {
        console.error("调试失败:", error.message);
    }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("调试失败:", error);
    process.exit(1);
  });
