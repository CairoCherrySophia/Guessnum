const { ethers } = require("hardhat");

async function main() {
  console.log("开始部署NumberGuessGame合约...");

  // 获取合约工厂
  const NumberGuessGame = await ethers.getContractFactory("NumberGuessGame");

  // 部署合约
  const gameContract = await NumberGuessGame.deploy();
  await gameContract.waitForDeployment();

  const contractAddress = await gameContract.getAddress();
  console.log("NumberGuessGame合约已部署到:", contractAddress);

  // 验证合约配置
  const config = await gameContract.config();
  console.log("游戏配置:");
  console.log("- 最小下注:", ethers.formatEther(config.minBet), "ETH");
  console.log("- 最大下注:", ethers.formatEther(config.maxBet), "ETH");
  console.log("- 平台手续费:", config.platformFeePercent.toString(), "%");
  console.log("- 庄家优势:", config.houseEdgePercent.toString(), "%");

  // 为奖池添加初始资金（可选）
  const initialPoolAmount = ethers.parseEther("1.0"); // 1 ETH
  const addToPoolTx = await gameContract.addToPool({ value: initialPoolAmount });
  await addToPoolTx.wait();
  console.log("已向奖池添加", ethers.formatEther(initialPoolAmount), "ETH");

  const poolBalance = await gameContract.getPoolBalance();
  console.log("当前奖池余额:", ethers.formatEther(poolBalance), "ETH");

  console.log("\n部署完成！");
  console.log("合约地址:", contractAddress);
  console.log("请将合约地址保存到前端配置中");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });
