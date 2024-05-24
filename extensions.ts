import { BasicERC1155C, BasicERC721C, FansCreate, MarketplaceV2, TokenGateway } from "./typechain-types";
import { extendEnvironment } from "hardhat/config";
import "hardhat/types/runtime";
import { ContractOrAddrName, getAddressForNetwork } from "./lib/constant";

interface HelperFuncs {
  loadTokenGateway(): Promise<TokenGateway>;
  loadMarketplace(): Promise<MarketplaceV2>;
  loadFansCreate(): Promise<FansCreate>;
  loadBasicERC721C(address: string): Promise<BasicERC721C>;
  loadBasicERC1155C(address: string): Promise<BasicERC1155C>;
}

declare module "hardhat/types/runtime" {
  export interface HardhatRuntimeEnvironment {
    helpers: HelperFuncs;
  }
}

extendEnvironment((hre) => {
  hre.helpers = {
    loadTokenGateway: () => {
      return hre.ethers.getContractAt(
        "TokenGateway",
        getAddressForNetwork(ContractOrAddrName.TokenGateway, hre.network.name)
      );
    },
    loadMarketplace: () => {
      return hre.ethers.getContractAt(
        "MarketplaceV2",
        getAddressForNetwork(ContractOrAddrName.MarketplaceV2, hre.network.name)
      );
    },
    loadFansCreate: () => {
      return hre.ethers.getContractAt(
        "FansCreate",
        getAddressForNetwork(ContractOrAddrName.FansCreate, hre.network.name)
      );
    },
    loadBasicERC721C: (address: string) => {
      return hre.ethers.getContractAt(
        "BasicERC721C",
        address
      );
    },
    loadBasicERC1155C: (address: string) => {
      return hre.ethers.getContractAt(
        "BasicERC1155C",
        address
      );
    }
  };
});
