const { ethers } = require("hardhat");

async function main() {
  console.log("开始部署到 Fhenix 测试网...");

  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log("部署者地址:", deployer.address);

  // 检查账户余额
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("账户余额不足，请先获取 Fhenix 测试网 ETH");
  }

  // 部署合约
  console.log("正在部署 NumberGuessGame 合约...");
  const NumberGuessGame = await ethers.getContractFactory("NumberGuessGame");
  const gameContract = await NumberGuessGame.deploy();
  
  await gameContract.waitForDeployment();
  const contractAddress = await gameContract.getAddress();
  
  console.log("合约部署成功!");
  console.log("合约地址:", contractAddress);
  console.log("部署者:", deployer.address);
  console.log("交易哈希:", gameContract.deploymentTransaction()?.hash);

  // 初始化奖池
  console.log("正在初始化奖池...");
  const initAmount = ethers.parseEther("10.0"); // 10 ETH 初始奖池
  const initTx = await gameContract.addToPool({ value: initAmount });
  await initTx.wait();
  console.log("奖池初始化完成，金额:", ethers.formatEther(initAmount), "ETH");

  // 验证部署
  console.log("正在验证部署...");
  const poolBalance = await gameContract.getPoolBalance();
  const config = await gameContract.config();
  const owner = await gameContract.owner();

  console.log("验证结果:");
  console.log("- 奖池余额:", ethers.formatEther(poolBalance), "ETH");
  console.log("- 合约所有者:", owner);
  console.log("- 最小下注:", ethers.formatEther(config.minBet), "ETH");
  console.log("- 最大下注:", ethers.formatEther(config.maxBet), "ETH");
  console.log("- 平台手续费:", config.platformFeePercent.toString(), "%");
  console.log("- 庄家优势:", config.houseEdgePercent.toString(), "%");

  // 保存部署信息
  const deploymentInfo = {
    network: "fhenix",
    chainId: 42069,
    contractAddress: contractAddress,
    deployer: deployer.address,
    deploymentTx: gameContract.deploymentTransaction()?.hash,
    initTx: initTx.hash,
    timestamp: new Date().toISOString(),
    poolBalance: ethers.formatEther(poolBalance),
    config: {
      minBet: ethers.formatEther(config.minBet),
      maxBet: ethers.formatEther(config.maxBet),
      platformFeePercent: config.platformFeePercent.toString(),
      houseEdgePercent: config.houseEdgePercent.toString()
    }
  };

  console.log("\n部署信息:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n部署完成! 请更新前端配置中的合约地址。");
  console.log("前端配置路径: frontend/src/config/contract.js");
  console.log("需要更新的地址:", contractAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });
