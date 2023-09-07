import hre from "hardhat";
import { ContractName, getAddressForCurrentNetwork } from "../../lib/constant";

async function main() {
  // We get the contract to deploy
  const Contract = await hre.ethers.getContractFactory("TokenGateway");
  const proxyAddress = getAddressForCurrentNetwork(ContractName.TokenGateway);
  const instance = await hre.upgrades.upgradeProxy(proxyAddress, Contract);
  await instance.waitForDeployment();

  console.log(`TokenGateway upgraded: ${proxyAddress}`);
  return instance;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
