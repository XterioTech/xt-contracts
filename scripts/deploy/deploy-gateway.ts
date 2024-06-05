import hre from "hardhat";
import { Color, colorize, infoAboutDeployer } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployGateway } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork } from "../../lib/constant";

const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let verifyAddress = process.env.verifyAddress;
  let gatewayAdmin = process.env.gatewayAdmin || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);

  if (!verifyAddress) {
    console.info(colorize(Color.blue, `Deploy TokenGateway`));
    await infoAboutDeployer(hre, deployer);
    console.info(colorize(Color.yellow, `Gateway Admin: ${gatewayAdmin}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`===================== Deploy TokenGateway =====================`);
    console.info(`============================================================`);
    const gateway = await deployGateway(gatewayAdmin, getTxOverridesForNetwork(hre.network.name));
    const proxyAddress = await gateway.getAddress();
    console.info(`TokenGateway proxy @ ${proxyAddress}`);

    const implAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.info(`TokenGateway impl @ ${implAddress}`);

    verifyAddress = proxyAddress;
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: verifyAddress,
        contract: "contracts/basic-tokens/management/TokenGateway.sol:TokenGateway",
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
