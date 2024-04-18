import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployFansCreate } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork } from "../../lib/constant";

const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;
  let admin = process.env.admin || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);
  let signer = process.env.signer;
  let recipient = process.env.recipient;
  let uri = process.env.uri; // || "https://api.xter.io/xgc/meta/works/{id}"

  if (!signer) {
    throw new Error("signer not set");
  }
  if (!recipient) {
    throw new Error("recipient not set");
  }
  if (!uri) {
    throw new Error("uri not set");
  }

  if (!address) {
    console.info(colorize(Color.blue, `Deploy FansCreate`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}`));
    console.info(colorize(Color.yellow, `Admin: ${admin}`));
    console.info(colorize(Color.yellow, `Signer: ${signer}`));
    console.info(colorize(Color.yellow, `Protocol Fee Recipient: ${recipient}`));
    console.info(colorize(Color.yellow, `Meta URI: ${uri}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`===================== Deploy FansCreate =====================`);
    console.info(`============================================================`);
    const fansCreate = await deployFansCreate(
      admin,
      signer,
      recipient,
      uri,
      getTxOverridesForNetwork(hre.network.name)
    );
    address = await fansCreate.getAddress();
    console.info(`FansCreate @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/fans-create/FansCreate.sol:FansCreate",
        constructorArguments: [admin, signer, recipient, uri],
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
