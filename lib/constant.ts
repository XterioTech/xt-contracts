type NetworkAddressMap = { [network: string]: string };
export enum ContractOrAddrName {
  TokenGateway = "TokenGateway",
  SafeManager = "SafeManager",
}

export const tokenGatewayAddressMap: NetworkAddressMap = {
  mainnet: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  opbnb: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  arbitrumOne: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  polygon: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  bsc: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  // Testnets
  goerli: "0xC8d6b1D3Cca37952465086D9D96DB0E1C96f4E1e",
  bscTestnet: "0xBAdCF947d6F23e7252d6b4bB9334Ce0cff0E0C0C",
  opbnbTestnet: "0x5d3757bC0f724aA4332DCa2184edA1b8a94eA0b6",
};

export const safeManagerAddressMap: NetworkAddressMap = {
  mainnet: "0x2100c6Ba5361f4Afa29c5d187aE5E0Cd5a0F9CF6",
  opbnb: "0x9b5D0Ccb7C95e448B742BA83D85282a38944b3E9", // Safe not available on opbnb, use XterAdmin1 address
  arbitrumOne: "0x2100c6Ba5361f4Afa29c5d187aE5E0Cd5a0F9CF6",
  polygon: "0x2100c6Ba5361f4Afa29c5d187aE5E0Cd5a0F9CF6",
  bsc: "0x2100c6Ba5361f4Afa29c5d187aE5E0Cd5a0F9CF6",
  // Testnets
  goerli: "0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26",
  bscTestnet: "0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26",
  opbnbTestnet: "0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26",
};

const hyperMap = {
  [ContractOrAddrName.TokenGateway]: tokenGatewayAddressMap,
  [ContractOrAddrName.SafeManager]: safeManagerAddressMap,
};

// helper functions
export function getAddressForNetwork(contract: ContractOrAddrName, network: string): string {
  const address = hyperMap[contract][network];
  if (!address) {
    throw new Error(`${contract} not deployed or address not configured on network [${network}]`);
  }
  return address;
}

export function getTxOverridesForNetwork(network: string): { gasPrice?: number } {
  switch (network) {
    case "opbnb":
      return { gasPrice: 1000000008 };
    case "polygon":
      return { gasPrice: 300000000000 };
    default:
      return {};
  }
}
