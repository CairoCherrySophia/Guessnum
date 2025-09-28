const { ethers } = require("hardhat");

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    console.error("请设置 CONTRACT_ADDRESS 环境变量");
    process.exit(1);
  }

  console.log("连接到合约:", contractAddress);

  // 获取合约实例
  const NumberGuessGame = await ethers.getContractFactory("NumberGuessGame");
  const gameContract = NumberGuessGame.attach(contractAddress);

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

  // 获取当前账户
  const [deployer] = await ethers.getSigners();
  console.log("\n当前账户:", deployer.address);

  // 检查账户余额
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), "ETH");

  // 示例：创建猜大小游戏
  console.log("\n=== 创建示例游戏 ===");
  try {
    const betAmount = ethers.parseEther("0.01"); // 0.01 ETH
    
    console.log("创建猜大小游戏（猜大）...");
    const tx = await gameContract.createGuessSizeGame(true, { value: betAmount });
    console.log("交易哈希:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("交易已确认，区块号:", receipt.blockNumber);
    
    // 获取游戏ID（从事件中）
    const gameCreatedEvent = receipt.logs.find(log => {
      try {
        const parsed = gameContract.interface.parseLog(log);
        return parsed.name === 'GameCreated';
      } catch (e) {
        return false;
      }
    });
    
    if (gameCreatedEvent) {
      const parsed = gameContract.interface.parseLog(gameCreatedEvent);
      const gameId = parsed.args.gameId;
      console.log("游戏ID:", gameId.toString());
      
      // 获取游戏详情
      const game = await gameContract.getGame(gameId);
      console.log("游戏详情:");
      console.log("- 游戏类型:", game.gameType === 0 ? "猜大小" : "猜数字");
      console.log("- 下注金额:", ethers.formatEther(game.betAmount), "ETH");
      console.log("- 猜测:", game.guess.toString());
      console.log("- 结果:", game.result.toString());
      console.log("- 状态:", game.status === 0 ? "进行中" : game.status === 1 ? "获胜" : "失败");
      console.log("- 奖励:", ethers.formatEther(game.reward), "ETH");
    }
    
  } catch (error) {
    console.error("创建游戏失败:", error.message);
  }

  // 获取玩家游戏历史
  console.log("\n=== 玩家游戏历史 ===");
  try {
    const playerGames = await gameContract.getPlayerGames(deployer.address);
    console.log("游戏数量:", playerGames.length);
    
    if (playerGames.length > 0) {
      console.log("最近的游戏:");
      for (let i = 0; i < Math.min(3, playerGames.length); i++) {
        const gameId = playerGames[i];
        const game = await gameContract.getGame(gameId);
        console.log(`游戏 #${gameId}: ${game.status === 1 ? "获胜" : game.status === 2 ? "失败" : "进行中"} - ${ethers.formatEther(game.betAmount)} ETH`);
      }
    }
  } catch (error) {
    console.error("获取游戏历史失败:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("交互失败:", error);
    process.exit(1);
  });
