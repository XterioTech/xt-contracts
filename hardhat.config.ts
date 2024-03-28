import fs from "fs";
import { ethers } from "ethers";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "@openzeppelin/hardhat-upgrades";
// import "@nomiclabs/hardhat-etherscan";
import "hardhat-abi-exporter";
import "hardhat-gas-reporter"
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
    goerli: {
      url: "https://goerli.infura.io/v3/" + process.env.API_KEY_INFURA,
      accounts: privateKey != "" ? [privateKey] : [],
    },
    sepolia: {
      url: "https://sepolia.infura.io/v3/" + process.env.API_KEY_INFURA,
      accounts: privateKey != "" ? [privateKey] : [],
    },
    bscTestnet: {
      chainId: 97,
      url: "https://data-seed-prebsc-2-s1.binance.org:8545",
      accounts: privateKey != "" ? [privateKey] : [],
    },
    bsc: {
      url: "https://nd-500-897-492.p2pify.com/a3e45094653b57e0699623939df446a9",
      accounts: privateKey != "" ? [privateKey] : [],
    },
    // opbnbTestnet: {
    //   url: `https://opbnb-testnet-rpc.bnbchain.org`,
    //   accounts: privateKey != "" ? [privateKey] : [],
    // },
    opbnbTestnet: {
      url: `https://opbnb-testnet.nodereal.io/v1/${process.env.API_KEY_NODEREAL_OPBNB}`,
      accounts: privateKey != "" ? [privateKey] : [],
    },
    opbnb: {
      url: "https://opbnb-mainnet-rpc.bnbchain.org",
      accounts: privateKey != "" ? [privateKey] : [],
    },
    // opbnb: {
    //   url: `https://opbnb-mainnet.nodereal.io/v1/${process.env.API_KEY_NODEREAL_OPBNB}`,
    //   accounts: privateKey != "" ? [privateKey] : [],
    // },
    arbitrumOne: {
      url: "https://arbitrum-one.publicnode.com",
      accounts: privateKey != "" ? [privateKey] : [],
    },
    polygon: {
      url: "https://polygon-rpc.com",
      accounts: privateKey != "" ? [privateKey] : [],
    },
    xterioTestnet: {
      url: "https://xterio-testnet.alt.technology/",
      accounts: privateKey != "" ? [privateKey] : [],
    },
    xterio: {
      url: "https://xterio.alt.technology/",
      accounts: privateKey != "" ? [privateKey] : [],
    }
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
      mainnet: process.env.API_KEY_ETHERSCAN || "",
      goerli: process.env.API_KEY_ETHERSCAN || "",
      sepolia: process.env.API_KEY_ETHERSCAN || "",
      bscTestnet: process.env.API_KEY_ETHERSCAN_BSCTESTNET || "",
      bsc: process.env.API_KEY_ETHERSCAN_BSC || "",
      opbnbTestnet: process.env.API_KEY_NODEREAL_OPBNB || "",
      opbnb: process.env.API_KEY_NODEREAL_OPBNB || "",
      arbitrumOne: process.env.API_KEY_ARBISCAN || "",
      polygon: process.env.API_KEY_POLYGONSCAN || "",
      xterioTestnet: "no need",
      xterio: "no need",
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
      {
        network: "xterioTestnet",
        chainId: 1637450,
        urls: {
          apiURL: `https://testnet.xterscan.io/api`,
          browserURL: "https://testnet.xterscan.io/",
        },
      },
      {
        network: "xterio",
        chainId: 112358,
        urls: {
          apiURL: `https://xterscan.io/api`,
          browserURL: "https://xterscan.io/",
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
  gasReporter: {
    currency: 'USD',
    gasPrice: 21,
    enabled: true,
    // outputFile: 'stdout',
    showTimeSpent: true
  }
};

export default config;
