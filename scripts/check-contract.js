const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0xF3B3cB8F038053ce7FD88F35fA764aA93e3F0573";
  
  console.log("检查合约状态:", contractAddress);
  console.log("网络: Sepolia测试网");

  // 获取合约实例
  const NumberGuessGame = await ethers.getContractFactory("NumberGuessGame");
  const gameContract = NumberGuessGame.attach(contractAddress);

  try {
    // 获取合约信息
    console.log("\n=== 合约信息 ===");
    const config = await gameContract.config();
    const poolBalance = await gameContract.getPoolBalance();
    const platformRevenue = await gameContract.getPlatformRevenue();
    const owner = await gameContract.owner();

    console.log("所有者:", owner);
    console.log("最小下注:", ethers.formatEther(config.minBet), "ETH");
    console.log("最大下注:", ethers.formatEther(config.maxBet), "ETH");
    console.log("平台手续费:", config.platformFeePercent.toString(), "%");
    console.log("庄家优势:", config.houseEdgePercent.toString(), "%");
    console.log("奖池余额:", ethers.formatEther(poolBalance), "ETH");
    console.log("平台收入:", ethers.formatEther(platformRevenue), "ETH");

    // 检查合约ETH余额
    const contractBalance = await ethers.provider.getBalance(contractAddress);
    console.log("合约ETH余额:", ethers.formatEther(contractBalance), "ETH");

    // 检查合约是否暂停
    const isPaused = await gameContract.paused();
    console.log("合约是否暂停:", isPaused);

    // 获取游戏计数器
    const gameCounter = await gameContract.gameCounter();
    console.log("游戏总数:", gameCounter.toString());

  } catch (error) {
    console.error("检查合约失败:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("检查失败:", error);
    process.exit(1);
  });
