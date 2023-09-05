import hre from "hardhat";

const proxyAddressMap: { [network: string]: string } = {
  goerli: "0xC8d6b1D3Cca37952465086D9D96DB0E1C96f4E1e",
  bscTestnet: "0xBAdCF947d6F23e7252d6b4bB9334Ce0cff0E0C0C",
  opbnbTestnet: "0x5d3757bC0f724aA4332DCa2184edA1b8a94eA0b6",
};

async function main() {
  // We get the contract to deploy
  const Contract = await hre.ethers.getContractFactory("TokenGateway");
  const proxyAddress = proxyAddressMap[hre.network.name];
  if (!proxyAddress) {
    throw new Error(`TokenGateway not deployed or address not configured on network [${hre.network.name}]`);
  }
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
