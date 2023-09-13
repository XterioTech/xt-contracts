import { TokenGateway } from "./typechain-types";
import { extendEnvironment } from "hardhat/config";
import "hardhat/types/runtime";
import { ContractName, getAddressForNetwork } from "./lib/constant";

interface HelperFuncs {
  loadTokenGateway(): Promise<TokenGateway>;
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
        getAddressForNetwork(ContractName.TokenGateway, hre.network.name)
      );
    },
  };
});