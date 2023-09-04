import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
// import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-abi-exporter";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  abiExporter: [
    {
      path: "./abi/pretty",
      pretty: true,
      runOnCompile: true,
      clear: true,
      flat: false,
    },
    {
      path: "./abi/ugly",
      pretty: false,
      runOnCompile: true,
      clear: true,
      flat: false,
    },
  ],
};

export default config;
