import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployTokenDistribute } from "../../lib/deploy";
import { getTxOverridesForNetwork } from "../../lib/constant";

const main = async () => {
  const [admin] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;

  if (!address) {
    console.info(colorize(Color.blue, `Deploy Distributer`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${admin.address}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`===================== Deploy Distributer ===================`);
    console.info(`============================================================`);
    const Distributer = await deployTokenDistribute(await admin.getAddress(), getTxOverridesForNetwork(hre.network.name));
    address = await Distributer.getAddress();
    console.info(`Distributer @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/airdrop/TokenDistribute.sol:TokenDistribute",
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
