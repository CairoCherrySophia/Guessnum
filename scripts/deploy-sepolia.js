const { ethers } = require("hardhat");

async function main() {
  console.log("开始部署到Sepolia测试网...");

  // 检查账户来源：支持 PRIVATE_KEY 或 MNEMONIC
  const hasPrivateKey = !!process.env.PRIVATE_KEY;
  const hasMnemonic = !!process.env.MNEMONIC;
  if (!hasPrivateKey && !hasMnemonic) {
    throw new Error("请设置 PRIVATE_KEY 或 MNEMONIC 环境变量（PowerShell: $env:PRIVATE_KEY 或 $env:MNEMONIC）");
  }
  console.log("账户来源:", hasPrivateKey ? "PRIVATE_KEY" : "MNEMONIC");

  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log("部署者地址:", deployer.address);

  // 检查账户余额
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("账户余额不足，至少需要0.01 ETH用于部署");
  }

  // 获取合约工厂
  const NumberGuessGame = await ethers.getContractFactory("NumberGuessGame");

  // 部署合约
  console.log("正在部署合约...");
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

  const poolBalance = await gameContract.getPoolBalance();
  console.log("当前奖池余额:", ethers.formatEther(poolBalance), "ETH");

  console.log("\n=== 部署完成 ===");
  console.log("合约地址:", contractAddress);
  console.log("网络: Sepolia测试网");
  console.log("链ID: 11155111");
  console.log("区块浏览器: https://sepolia.etherscan.io/address/" + contractAddress);
  console.log("\n请将合约地址更新到前端配置中:");
  console.log("REACT_APP_CONTRACT_ADDRESS=" + contractAddress);
  console.log("REACT_APP_NETWORK_ID=11155111");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });
