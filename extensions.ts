import { FansCreate, TokenGateway } from "./typechain-types";
import { extendEnvironment } from "hardhat/config";
import "hardhat/types/runtime";
import { ContractOrAddrName, getAddressForNetwork } from "./lib/constant";

interface HelperFuncs {
  loadTokenGateway(): Promise<TokenGateway>;
  loadFansCreate(): Promise<FansCreate>;
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
    loadFansCreate: () => {
      return hre.ethers.getContractAt(
        "FansCreate",
        getAddressForNetwork(ContractOrAddrName.FansCreate, hre.network.name)
      );
    }
  };
});
