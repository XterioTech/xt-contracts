import hre from "hardhat";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork } from "../../lib/constant";

async function main() {
  // We get the contract to deploy
  const Contract = await hre.ethers.getContractFactory("MarketplaceV2");
  const proxyAddress = getAddressForNetwork(ContractOrAddrName.MarketplaceV2, hre.network.name);

  const implAddressOld = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
  const instance = await hre.upgrades.upgradeProxy(proxyAddress, Contract, {
    txOverrides: getTxOverridesForNetwork(hre.network.name),
  });
  await instance.waitForDeployment();
  const implAddressNew = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log(`MarketplaceV2 upgraded: ${proxyAddress}`);
  console.log(`Impl Address: ${implAddressOld} => ${implAddressNew}`);
  return instance;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
