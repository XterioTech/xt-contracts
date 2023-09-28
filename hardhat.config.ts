import fs from "fs";
import { ethers } from "ethers";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "@openzeppelin/hardhat-upgrades";
// import "@nomiclabs/hardhat-etherscan";
import "hardhat-abi-exporter";
import * as dotenv from "dotenv";
dotenv.config();
import "./extensions";

let privateKey = "";
if (process.env.ACCOUNT_PRIVATE_KEY) {
  privateKey = process.env.ACCOUNT_PRIVATE_KEY;
} else if (process.env.WALLET_PASSWORD) {
  const json = fs.readFileSync("wallet.json", { encoding: "utf8", flag: "r" });
  const wallet = ethers.Wallet.fromEncryptedJsonSync(json, process.env.WALLET_PASSWORD);
  privateKey = wallet.privateKey;
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {},
    mainnet: {
      url: "https://mainnet.infura.io/v3/" + process.env.API_KEY_INFURA,
      accounts: privateKey != "" ? [privateKey] : [],
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/" + process.env.API_KEY_INFURA,
      accounts: privateKey != "" ? [privateKey] : [],
    },
    goerli: {
      url: "https://goerli.infura.io/v3/" + process.env.API_KEY_INFURA,
      accounts: privateKey != "" ? [privateKey] : [],
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-2-s1.binance.org:8545",
      accounts: privateKey != "" ? [privateKey] : [],
    },
    bsc: {
      url: "https://nd-500-897-492.p2pify.com/a3e45094653b57e0699623939df446a9",
      accounts: privateKey != "" ? [privateKey] : [],
    },
    opbnbTestnet: {
      url: `https://opbnb-testnet-rpc.bnbchain.org`,
      accounts: privateKey != "" ? [privateKey] : [],
    },
    // opbnbTestnet: {
    //   url: `https://opbnb-testnet.nodereal.io/v1/${process.env.API_KEY_NODEREAL_OPBNB}`,
    //   accounts: privateKey != "" ? [privateKey] : [],
    // },
    opbnb: {
      url: "https://opbnb-mainnet-rpc.bnbchain.org",
      accounts: privateKey != "" ? [privateKey] : [],
    },
    // opbnb: {
    //   url: `https://opbnb-mainnet.nodereal.io/v1/${process.env.API_KEY_NODEREAL_OPBNB}`,
    //   accounts: privateKey != "" ? [privateKey] : [],
    // },
  },
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  etherscan: {
    apiKey: {
      rinkeby: process.env.API_KEY_ETHERSCAN || "",
      goerli: process.env.API_KEY_ETHERSCAN || "",
      bscTestnet: process.env.API_KEY_ETHERSCAN_BSCTESTNET || "",
      bsc: process.env.API_KEY_ETHERSCAN_BSC || "",
      opbnbTestnet: process.env.API_KEY_NODEREAL_OPBNB || "",
      opbnb: process.env.API_KEY_NODEREAL_OPBNB || "",
    },
    customChains: [
      {
        network: "opbnbTestnet",
        chainId: 5611,
        urls: {
          apiURL: `https://open-platform.nodereal.io/${process.env.API_KEY_NODEREAL_OPBNB}/op-bnb-testnet/contract/`,
          browserURL: "https://testnet.opbnbscan.com/",
        },
      },
      {
        network: "opbnb",
        chainId: 204,
        urls: {
          apiURL: `https://open-platform.nodereal.io/${process.env.API_KEY_NODEREAL_OPBNB}/op-bnb-mainnet/contract/`,
          browserURL: "https://opbnbscan.com/",
        },
      },
    ],
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
