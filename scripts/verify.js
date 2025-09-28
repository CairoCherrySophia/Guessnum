const { run } = require("hardhat");

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    console.error("请设置 CONTRACT_ADDRESS 环境变量");
    process.exit(1);
  }

  console.log("开始验证合约...");
  console.log("合约地址:", contractAddress);

  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
    });
    
    console.log("合约验证成功！");
  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("合约已经验证过了");
    } else {
      console.error("合约验证失败:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("验证失败:", error);
    process.exit(1);
  });
