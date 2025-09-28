const { ethers } = require("ethers");

// 合约ABI
const CONTRACT_ABI = [
  "function addToPool() external payable",
  "function getPoolBalance() external view returns (uint256)",
  "function owner() external view returns (address)"
];

async function main() {
  const contractAddress = "0x1820100DF42773B4B1D9983331AD357B412366FB";
  
  // 使用公共RPC端点
  const provider = new ethers.JsonRpcProvider("https://sepolia.drpc.org");
  const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, provider);
  
  console.log("=== 修复奖池问题 ===");
  console.log("合约地址:", contractAddress);
  
  try {
    // 检查当前奖池余额
    const currentPool = await contract.getPoolBalance();
    console.log("当前奖池余额:", ethers.formatEther(currentPool), "ETH");
    
    // 检查合约所有者
    const owner = await contract.owner();
    console.log("合约所有者:", owner);
    
    console.log("\n=== 问题分析 ===");
    console.log("1. 奖池余额不足可能导致奖励支付失败");
    console.log("2. 需要向奖池添加更多资金");
    console.log("3. 建议添加至少0.5 ETH到奖池");
    
    console.log("\n=== 解决方案 ===");
    console.log("请使用合约所有者账户执行以下操作：");
    console.log("1. 连接到Sepolia测试网");
    console.log("2. 确保账户有足够的ETH");
    console.log("3. 调用 addToPool() 函数向奖池添加资金");
    
    // 计算建议的奖池金额
    const suggestedAmount = ethers.parseEther("0.5");
    console.log("\n建议添加金额:", ethers.formatEther(suggestedAmount), "ETH");
    console.log("添加后奖池余额:", ethers.formatEther(currentPool + suggestedAmount), "ETH");
    
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
