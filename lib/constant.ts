type NetworkAddressMap = { [network: string]: string };
export enum ContractName {
  TokenGateway = "TokenGateway",
}

export const tokenGatewayAddressMap: NetworkAddressMap = {
  goerli: "0xC8d6b1D3Cca37952465086D9D96DB0E1C96f4E1e",
  bscTestnet: "0xBAdCF947d6F23e7252d6b4bB9334Ce0cff0E0C0C",
  opbnbTestnet: "0x5d3757bC0f724aA4332DCa2184edA1b8a94eA0b6",
};

const hyperMap = {
  [ContractName.TokenGateway]: tokenGatewayAddressMap,
};

// helper functions
export function getAddressForNetwork(contract: ContractName, network: string): string {
  const address = hyperMap[contract][network];
  if (!address) {
    throw new Error(`${contract} not deployed or address not configured on network [${network}]`);
  }
  return address;
}
