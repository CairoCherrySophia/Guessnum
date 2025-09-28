const { ethers } = require("ethers");

async function main() {
  const contractAddress = "0x1820100DF42773B4B1D9983331AD357B412366FB";
  
  // 使用公共RPC端点
  const provider = new ethers.JsonRpcProvider("https://sepolia.drpc.org");
  
  console.log("检查合约状态:", contractAddress);
  console.log("网络: Sepolia测试网");

  try {
    // 检查合约ETH余额
    const contractBalance = await provider.getBalance(contractAddress);
    console.log("合约ETH余额:", ethers.formatEther(contractBalance), "ETH");

    // 检查合约代码是否存在
    const code = await provider.getCode(contractAddress);
    console.log("合约代码长度:", code.length);
    console.log("合约是否已部署:", code !== "0x");

    if (code !== "0x") {
      console.log("合约已成功部署");
    } else {
      console.log("合约未部署或地址错误");
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
