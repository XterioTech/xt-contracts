import hre from "hardhat";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork } from "../../lib/constant";

async function main() {
  // We get the contract to deploy
  const Contract = await hre.ethers.getContractFactory("TokenGateway");
  const proxyAddress = getAddressForNetwork(ContractOrAddrName.TokenGateway, hre.network.name);

  const implAddressOld = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
  const instance = await hre.upgrades.upgradeProxy(proxyAddress, Contract, {
    txOverrides: getTxOverridesForNetwork(hre.network.name),
  });
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
