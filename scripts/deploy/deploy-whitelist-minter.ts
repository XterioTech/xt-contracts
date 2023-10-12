import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployWhitelistMinter } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork } from "../../lib/constant";

const main = async () => {
  const [admin] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;

  const gatewayAddress = getAddressForNetwork(ContractOrAddrName.TokenGateway, hre.network.name);
  if (!address) {
    console.info(colorize(Color.blue, `Deploy WhitelistMinter`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${admin.address}`));
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

    // in mainnet, we do this mannually through multisig address
    // console.info("Add operator whitelist in TokenGateway...");
    // const gateway = await hre.ethers.getContractAt("TokenGateway", gatewayAddress);
    // await gateway.addOperatorWhitelist(address);
    console.warn("Remember to add WhitelistMinter address to tokenGateway's operator whitelist");
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/basic-tokens/WhitelistMinter.sol:WhitelistMinter",
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
