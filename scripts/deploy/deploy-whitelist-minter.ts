import hre from "hardhat";
import { Color, colorize, infoAboutDeployer } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployWhitelistMinter } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork, isTestnet } from "../../lib/constant";

const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;

  const gatewayAddress = getAddressForNetwork(ContractOrAddrName.TokenGateway, hre.network.name);
  if (!address) {
    console.info(colorize(Color.blue, `Deploy WhitelistMinter`));
    await infoAboutDeployer(hre, deployer);
    console.info(colorize(Color.yellow, `TokenGateway: ${gatewayAddress}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`===================== Deploy WhitelistMinter =====================`);
    console.info(`============================================================`);
    const whitelistMinter = await deployWhitelistMinter(gatewayAddress, getTxOverridesForNetwork(hre.network.name));
    address = await whitelistMinter.getAddress();
    console.info(`WhitelistMinter @ ${address}`);

    if (isTestnet(hre.network.name)) {
      // console.info("Add operator whitelist in TokenGateway...");
      const gateway = await hre.ethers.getContractAt("TokenGateway", gatewayAddress);
      await gateway.addOperatorWhitelist(address, getTxOverridesForNetwork(hre.network.name));
    } else {
      // in mainnet, we do this mannually through multisig address
      console.warn(
        colorize(Color.yellow, "Remember to add WhitelistMinter address to tokenGateway's operator whitelist")
      );
    }
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/launchpad/WhitelistMinter.sol:WhitelistMinter",
        constructorArguments: [gatewayAddress],
      });
    } catch (e) {
      console.warn(`Verify failed: ${e}`);
    }
  }
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
