import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployCreatorTokenTransferValidator } from "../../lib/deploy";

const main = async () => {
  const [admin] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;

  if (!address) {
    console.info(colorize(Color.blue, `Deploy CreatorTokenTransferValidator`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${admin.address}`));
    console.info(colorize(Color.yellow, `Default Owner: ${admin.address}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`===================== Deploy CreatorTokenTransferValidator =====================`);
    console.info(`============================================================`);
    const validator = await deployCreatorTokenTransferValidator(admin.address);
    address = await validator.getAddress();
    console.info(`CreatorTokenTransferValidator @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract:
          "@limitbreak/creator-token-contracts/contracts/utils/CreatorTokenTransferValidator.sol:CreatorTokenTransferValidator",
        constructorArguments: [admin.address],
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
