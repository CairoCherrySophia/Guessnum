const { ethers } = require("hardhat");

async function main() {
  console.log("=== 向奖池添加资金 ===");
  
  // 检查私钥
  if (!process.env.PRIVATE_KEY) {
    throw new Error("请设置PRIVATE_KEY环境变量");
  }

  // 获取部署者账户
  const [deployer] = await ethers.getSigners();
  console.log("账户地址:", deployer.address);

  // 检查账户余额
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.1")) {
    throw new Error("账户余额不足，至少需要0.1 ETH");
  }

  const contractAddress = "0x1820100DF42773B4B1D9983331AD357B412366FB";
  
  // 获取合约实例
  const NumberGuessGame = await ethers.getContractFactory("NumberGuessGame");
  const gameContract = NumberGuessGame.attach(contractAddress);

  // 检查当前奖池余额
  const currentPool = await gameContract.getPoolBalance();
  console.log("当前奖池余额:", ethers.formatEther(currentPool), "ETH");

  // 添加资金到奖池
  const addAmount = ethers.parseEther("0.5"); // 添加0.5 ETH
  console.log("正在向奖池添加", ethers.formatEther(addAmount), "ETH...");
  
  const tx = await gameContract.addToPool({ value: addAmount });
  console.log("交易哈希:", tx.hash);
  
  const receipt = await tx.wait();
  console.log("交易已确认，区块号:", receipt.blockNumber);

  // 检查更新后的奖池余额
  const newPool = await gameContract.getPoolBalance();
  console.log("更新后奖池余额:", ethers.formatEther(newPool), "ETH");
  
  console.log("\n=== 完成 ===");
  console.log("奖池已成功补充资金，现在可以正常支付奖励了！");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("添加资金失败:", error);
    process.exit(1);
  });
