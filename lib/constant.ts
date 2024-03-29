type NetworkAddressMap = { [network: string]: string };
export enum ContractOrAddrName {
  TokenGateway = "TokenGateway",
  MarketplaceV2 = "MarketplaceV2",
  FansCreate = "FansCreate",
  SafeManager = "SafeManager",
}

export const tokenGatewayAddressMap: NetworkAddressMap = {
  mainnet: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  opbnb: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  arbitrumOne: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  polygon: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  bsc: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  // Testnets
  sepolia: "0x38f9e50EBF26e4E01db00aE5238e725d8647b115",
  goerli: "0xC8d6b1D3Cca37952465086D9D96DB0E1C96f4E1e",
  bscTestnet: "0xBAdCF947d6F23e7252d6b4bB9334Ce0cff0E0C0C",
  opbnbTestnet: "0x5d3757bC0f724aA4332DCa2184edA1b8a94eA0b6",
};

export const marketplaceV2AddressMap: NetworkAddressMap = {
  mainnet: "0xFC1759E75180aeE982DC08D0d6D365ebFA0296a7",
  opbnb: "0xFC1759E75180aeE982DC08D0d6D365ebFA0296a7",
  arbitrumOne: "0xFC1759E75180aeE982DC08D0d6D365ebFA0296a7",
  polygon: "0xFC1759E75180aeE982DC08D0d6D365ebFA0296a7",
  bsc: "0xFC1759E75180aeE982DC08D0d6D365ebFA0296a7",
  // Testnets
  goerli: "0xDbE4F513dBc79dEF048Df54D870EfB3B2edE01cB",
  bscTestnet: "0x2973fAe1Db21e3f30dF115d43094E7B2d83251c5",
  opbnbTestnet: "0x1dDee87268F5AF34Ef2fBD128D0D8Dd21b67Bdb1",
};

export const fansCreateAddressMap: NetworkAddressMap = {
  // Testnets
  // bscTestnet: "0x99209b34A57c843EC4B18E10e1bf543fB06242E6",
  bscTestnet: "0xe0E63afFfab9Ef380CF1d057300C033734650252",
};

export const safeManagerAddressMap: NetworkAddressMap = {
  mainnet: "0x2100c6Ba5361f4Afa29c5d187aE5E0Cd5a0F9CF6",
  opbnb: "0x9b5D0Ccb7C95e448B742BA83D85282a38944b3E9", // Safe not available on opbnb, use XterAdmin1 address
  arbitrumOne: "0x2100c6Ba5361f4Afa29c5d187aE5E0Cd5a0F9CF6",
  polygon: "0x2100c6Ba5361f4Afa29c5d187aE5E0Cd5a0F9CF6",
  bsc: "0x2100c6Ba5361f4Afa29c5d187aE5E0Cd5a0F9CF6",
  // Testnets
  sepolia: "0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26",
  goerli: "0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26",
  bscTestnet: "0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26",
  opbnbTestnet: "0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26",
};

const hyperMap = {
  [ContractOrAddrName.TokenGateway]: tokenGatewayAddressMap,
  [ContractOrAddrName.MarketplaceV2]: marketplaceV2AddressMap,
  [ContractOrAddrName.FansCreate]: fansCreateAddressMap,
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
    case "bscTestnet":
      return { gasPrice: 5000000000 };
    case "opbnb":
      return { gasPrice: 1000000008 };
    case "polygon":
      return { gasPrice: 300000000000 };
    case "opbnbTestnet":
      return { gasPrice: 2500000008 };
    default:
      return {};
  }
}

export function isTestnet(network: string): boolean {
  return network == "goerli" || network == "sepolia" || network == "bscTestnet" || network == "opbnbTestnet";
}
