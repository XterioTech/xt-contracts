import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployRefund } from "../../lib/deploy";

const main = async () => {
  const [admin] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;

  if (!address) {
    console.info(colorize(Color.blue, `Deploy Refunder`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${admin.address}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`===================== Deploy Refunder ======================`);
    console.info(`============================================================`);
    const refunder = await deployRefund(await admin.getAddress());
    address = await refunder.getAddress();
    console.info(`Refunder @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/launchpad/Refund.sol:Refund",
        constructorArguments: [await admin.getAddress()],
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
