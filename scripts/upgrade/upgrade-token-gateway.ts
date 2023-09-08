import hre from "hardhat";
import { ContractName, getAddressForNetwork } from "../../lib/constant";

async function main() {
  // We get the contract to deploy
  const Contract = await hre.ethers.getContractFactory("TokenGateway");
  const proxyAddress = getAddressForNetwork(ContractName.TokenGateway, hre.network.name);
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
