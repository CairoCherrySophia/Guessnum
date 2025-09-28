require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
// 提示：如需使用FHE相关能力，请根据实际可用包接入，例如 @zama/fhevm 或官方插件

// 账户与RPC配置：支持 $env:MNEMONIC 或 $env:PRIVATE_KEY；Sepolia 公网 RPC 回落
const MNEMONIC = process.env.MNEMONIC;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const accountsConfig = MNEMONIC ? { mnemonic: MNEMONIC } : (PRIVATE_KEY ? [PRIVATE_KEY] : []);
const sepoliaUrl = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    sepolia: {
      url: sepoliaUrl,
      accounts: accountsConfig,
      chainId: 11155111
    },
    fhenix: {
      url: "https://api.testnet.fhenix.zone:7747",
      accounts: accountsConfig,
      chainId: 42069
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || ""
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
