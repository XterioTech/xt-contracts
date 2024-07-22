import hre from "hardhat";
import { colorize, Color, infoAboutDeployer } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployFansCreateBNBUpgradeable } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork } from "../../lib/constant";

const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let verifyAddress = process.env.verifyAddress;
  const admin = process.env.admin || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);
  const signer = process.env.signer;
  const recipient = process.env.recipient;
  const uri = process.env.uri;

  if (!signer) {
    throw new Error("signer not set");
  }
  if (!recipient) {
    throw new Error("recipient not set");
  }
  if (!uri) {
    throw new Error("uri not set");
  }

  if (!verifyAddress) {
    console.info(colorize(Color.blue, `Deploy FansCreateBNBUpgradeable`));
    await infoAboutDeployer(hre, deployer);
    console.info(colorize(Color.yellow, `Admin: ${admin}`));
    console.info(colorize(Color.yellow, `Signer: ${signer}`));
    console.info(colorize(Color.yellow, `Recipient: ${recipient}`));
    console.info(colorize(Color.yellow, `URI: ${uri}`));

    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`============= Deploy FansCreateBNBUpgradeable ==============`);
    console.info(`============================================================`);
    const fansCreateBNB = await deployFansCreateBNBUpgradeable(
      admin,
      signer,
      recipient,
      uri,
      getTxOverridesForNetwork(hre.network.name)
    );
    const proxyAddress = await fansCreateBNB.getAddress();
    console.info(`FansCreateBNBUpgradeable proxy @ ${proxyAddress}`);

    const implAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.info(`FansCreateBNBUpgradeable impl @ ${implAddress}`);

    verifyAddress = proxyAddress;
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: verifyAddress,
        contract: "contracts/fans-create-upgradeable/FansCreateBNBUpgradeable.sol:FansCreateBNBUpgradeable",
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
