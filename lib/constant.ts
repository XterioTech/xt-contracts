import { NonPayableOverrides } from "../typechain-types/common";

type NetworkAddressMap = { [network: string]: string };
export enum ContractOrAddrName {
  TokenGateway = "TokenGateway",
  MarketplaceV2 = "MarketplaceV2",
  FansCreate = "FansCreate",
  SafeManager = "SafeManager",
  OnchainIAP = "OnchainIAP",
  XterStaking = "XterStaking",
}

export const tokenGatewayAddressMap: NetworkAddressMap = {
  mainnet: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  opbnb: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  arbitrumOne: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  polygon: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  bsc: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  xterio: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  xterioEth: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  base: "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
  // Testnets
  sepolia: "0x38f9e50EBF26e4E01db00aE5238e725d8647b115",
  goerli: "0xC8d6b1D3Cca37952465086D9D96DB0E1C96f4E1e",
  bscTestnet: "0xBAdCF947d6F23e7252d6b4bB9334Ce0cff0E0C0C",
  opbnbTestnet: "0x5d3757bC0f724aA4332DCa2184edA1b8a94eA0b6",
  xterioTestnet: "0x1266EFc5430a871b44d5BC29C67f89B3134902Bb",
};

export const marketplaceV2AddressMap: NetworkAddressMap = {
  mainnet: "0xFC1759E75180aeE982DC08D0d6D365ebFA0296a7",
  opbnb: "0xFC1759E75180aeE982DC08D0d6D365ebFA0296a7",
  arbitrumOne: "0xFC1759E75180aeE982DC08D0d6D365ebFA0296a7",
  polygon: "0xFC1759E75180aeE982DC08D0d6D365ebFA0296a7",
  bsc: "0xFC1759E75180aeE982DC08D0d6D365ebFA0296a7",
  xterio: "0xFC1759E75180aeE982DC08D0d6D365ebFA0296a7",
  xterioEth: "0xFC1759E75180aeE982DC08D0d6D365ebFA0296a7",
  base: "0xFC1759E75180aeE982DC08D0d6D365ebFA0296a7",
  // Testnets
  goerli: "0xDbE4F513dBc79dEF048Df54D870EfB3B2edE01cB",
  sepolia: "0xBAdCF947d6F23e7252d6b4bB9334Ce0cff0E0C0C",
  bscTestnet: "0x2973fAe1Db21e3f30dF115d43094E7B2d83251c5",
  opbnbTestnet: "0x1dDee87268F5AF34Ef2fBD128D0D8Dd21b67Bdb1",
  xterioTestnet: "0xD5c5930f96e9743931ac5B2925792007a6665546",
};

export const fansCreateAddressMap: NetworkAddressMap = {
  // Testnets
  xterioTestnet: "0x4CaF4cb43C455Ed66E643cB7d59c45b38E66d0D0",
  xterio: "0x7e913A13740ab75df2B34249059879948F5157D0",
};

export const onchainIAPAddressMap: NetworkAddressMap = {
  mainnet: "0xD9A1b8D84FB0Db3C95cfaAb819Ae18EBE4634891",
  opbnb: "0xD9A1b8D84FB0Db3C95cfaAb819Ae18EBE4634891",
  arbitrumOne: "0xD9A1b8D84FB0Db3C95cfaAb819Ae18EBE4634891",
  polygon: "0xD9A1b8D84FB0Db3C95cfaAb819Ae18EBE4634891",
  bsc: "0xD9A1b8D84FB0Db3C95cfaAb819Ae18EBE4634891",
  xterio: "0xD9A1b8D84FB0Db3C95cfaAb819Ae18EBE4634891",
  xterioEth: "0xD9A1b8D84FB0Db3C95cfaAb819Ae18EBE4634891",
  base: "0xD9A1b8D84FB0Db3C95cfaAb819Ae18EBE4634891",
  // Testnets
  sepolia: '0x6F58796D4563a5140Cb636Fd4C48EB20fe97ff1F',        //for stage eng
  // sepolia: '0x1cDc98Abe4dB79b332206dD7a89742F0f59255F7',        //for test eng
  xterioTestnet: "0xd3875f07496d65fc09Ad455ca53194A77eBCb504",  // for stage env
  // xterioTestnet: "0x5949430506ff6Ce098a5DdD8a062D3Da7373b365",  // for test env
  bscTestnet: "0x80e3D84C66ddEC4f0E25400a51297353a26243d1",   // for stage env
};

export const safeManagerAddressMap: NetworkAddressMap = {
  mainnet: "0x2100c6Ba5361f4Afa29c5d187aE5E0Cd5a0F9CF6",
  opbnb: "0x9b5D0Ccb7C95e448B742BA83D85282a38944b3E9", // Safe not available on opbnb, use XterAdmin1 address
  arbitrumOne: "0x2100c6Ba5361f4Afa29c5d187aE5E0Cd5a0F9CF6",
  polygon: "0x2100c6Ba5361f4Afa29c5d187aE5E0Cd5a0F9CF6",
  bsc: "0x2100c6Ba5361f4Afa29c5d187aE5E0Cd5a0F9CF6",
  xterio: "0x9b5D0Ccb7C95e448B742BA83D85282a38944b3E9", // Safe not available on xterio chain (BNB), use XterAdmin1 address
  xterioEth: "0x9b5D0Ccb7C95e448B742BA83D85282a38944b3E9", // Safe not available on xterio chain (ETH), use XterAdmin1 address
  base: "0xB5472ffef665d1a27538FAa35a5c40cb5f11e28A", // Base has a different official factory address, so the safe address is different
  // Testnets
  sepolia: "0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26",
  goerli: "0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26",
  bscTestnet: "0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26",
  opbnbTestnet: "0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26",
  xterioTestnet: "0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26",
};

export const xterStakingAddressMap: NetworkAddressMap = {
  xterio: "0xC054eF315bCeAb5046848604DD98540c83Ba0B9a",
  xterioTestnet: "0xDC24e9e31664105b1866f8B6753896E20Bc56f59",
};

const hyperMap = {
  [ContractOrAddrName.TokenGateway]: tokenGatewayAddressMap,
  [ContractOrAddrName.MarketplaceV2]: marketplaceV2AddressMap,
  [ContractOrAddrName.FansCreate]: fansCreateAddressMap,
  [ContractOrAddrName.SafeManager]: safeManagerAddressMap,
  [ContractOrAddrName.OnchainIAP]: onchainIAPAddressMap,
  [ContractOrAddrName.XterStaking]: xterStakingAddressMap,
};

// helper functions
export function getAddressForNetwork(contract: ContractOrAddrName, network: string): string {
  const address = hyperMap[contract][network];
  if (!address) {
    throw new Error(`${contract} not deployed or address not configured on network [${network}]`);
  }
  return address;
}

export function getTxOverridesForNetwork(network: string): NonPayableOverrides & { from?: string } {
  switch (network) {
    case "bscTestnet":
      return { gasPrice: 5000000000 };
    case "opbnb":
      return { gasPrice: 1000000008 };
    case "polygon":
      return { gasPrice: 300000000000 };
    case "opbnbTestnet":
      return { gasPrice: 2500000008 };
    case "xterio":
      return { maxPriorityFeePerGas: 100000000, maxFeePerGas: 1100000000 };
    default:
      return {};
  }
}

export function isTestnet(network: string): boolean {
  return (
    network == "goerli" ||
    network == "sepolia" ||
    network == "bscTestnet" ||
    network == "opbnbTestnet" ||
    network == "xterioTestnet"
  );
}
