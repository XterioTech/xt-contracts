require('dotenv').config();
import { ethers } from 'ethers';
import * as NETWORK from '../constants/network';

export const providerByNetwork = function (network: string) {
  switch (network) {
    case NETWORK.ETHEREUM:
      return new ethers.InfuraProvider(network, process.env.API_KEY_INFURA)
    // case NETWORK.ARBITRUM:
    //   //ToDo...
    //   return undefined
    // case NETWORK.POLYGON:
    //   //ToDo...
    //   return undefined
    case NETWORK.OPBNB:
      return new ethers.JsonRpcProvider(`https://opbnb-mainnet-rpc.bnbchain.org`, {
        name: 'Opbnb',
        chainId: 204
      })
    case NETWORK.BSC:
      return new ethers.JsonRpcProvider('https://bsc-dataseed.bnbchain.org', { name: 'binance', chainId: 56 })
    case NETWORK.BSC_TESTNET:
      return new ethers.JsonRpcProvider('https://data-seed-prebsc-2-s1.binance.org:8545', {
        name: 'Binance Smart Chain Testnet',
        chainId: 97
      })
    case NETWORK.GOERLI:
      return new ethers.InfuraProvider(network, process.env.API_KEY_INFURA)
    case NETWORK.SEPOLIA:
      return new ethers.JsonRpcProvider(`https://ethereum-sepolia.blockpi.network/v1/rpc/public`)
    case NETWORK.XTERIO:
      return new ethers.JsonRpcProvider(`https://xterio-fullnode.alt.technology/`)
    // return new ethers.JsonRpcProvider(`https://xterio.alt.technology/`)
    case NETWORK.XTERIO_TESTNET:
      return new ethers.JsonRpcProvider(`https://xterio-testnet.alt.technology/`)
    case NETWORK.OPBNB_TESTNET:
      return new ethers.JsonRpcProvider(`https://opbnb-testnet.nodereal.io/v1/${process.env.API_KEY_NODEREAL_OPBNB}`, {
        name: 'Opbnb Testnet',
        chainId: 5611
      })
    default:
      return new ethers.InfuraProvider(network, process.env.API_KEY_INFURA)
  }
};
