import hre from "hardhat";
import { ContractName, getAddressForNetwork } from "../../lib/constant";

async function main() {
  // We get the contract to deploy
  const Contract = await hre.ethers.getContractFactory("TokenGateway");
  const proxyAddress = getAddressForNetwork(ContractName.TokenGateway, hre.network.name);

  const implAddressOld = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
  const instance = await hre.upgrades.upgradeProxy(proxyAddress, Contract);
  await instance.waitForDeployment();
  const implAddressNew = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log(`TokenGateway upgraded: ${proxyAddress}`);
  console.log(`Impl Address: ${implAddressOld} => ${implAddressNew}`);
  return instance;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
