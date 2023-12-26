import hre from "hardhat";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork } from "../../lib/constant";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployMajorToken } from "../../lib/deploy";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;
  let admin = process.env.admin || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);
  let wallet = process.env.wallet || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);

  if (!address) {
    console.info(colorize(Color.blue, `Deploy XterToken`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`===================== Deploy XterToken =====================`);
    console.info(`============================================================`);
    const xter = await deployMajorToken(admin, wallet, getTxOverridesForNetwork(hre.network.name));
    address = await xter.getAddress();
    console.info(`XterToken @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/XterToken.sol:XterToken",
        constructorArguments: [admin, wallet],
      });
    } catch (e) {
      console.warn(`Verify failed: ${e}`);
    }
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
