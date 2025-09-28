// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {CoprocessorConfig} from "@fhevm/solidity/lib/Impl.sol";

library LocalZamaConfig {
    function getSepoliaProtocolId() internal pure returns (uint256) {
        return 10001; // 与官方约定一致
    }

    function getSepoliaConfig() internal pure returns (CoprocessorConfig memory) {
        // 说明：以下地址参考官方库的 ACL 与 Coprocessor 地址；
        // DecryptionOracleAddress 暂设为占位地址，需替换为 Zama 提供的实际 Sepolia 预言机地址。
        return CoprocessorConfig({
            ACLAddress: 0x687820221192C5B662b25367F70076A37bc79b6c,
            CoprocessorAddress: 0x848B0066793BcC60346Da1F49049357399B8D595,
            DecryptionOracleAddress: 0x000000000000000000000000000000000000dEaD,
            KMSVerifierAddress: 0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC
        });
    }
}

contract SepoliaConfig {
    constructor() {
        FHE.setCoprocessor(LocalZamaConfig.getSepoliaConfig());
    }

    function protocolId() public pure returns (uint256) {
        return LocalZamaConfig.getSepoliaProtocolId();
    }
}


