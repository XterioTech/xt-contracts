import hre from "hardhat";
import { Color, colorize, infoAboutDeployer } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployXterStakeDelegator } from "../../lib/deploy";
import { ContractOrAddrName } from "../../lib/constant";
import { getAddressForNetwork } from "../../lib/constant";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;
  const admin = process.env.admin || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);
  const whitelistClaimERC20 = process.env.whitelistClaimERC20
  const xterStaking = process.env.xterStaking

  if (!whitelistClaimERC20) {
    throw new Error("whitelistClaimERC20 not set");
  }
  if (!xterStaking) {
    throw new Error("xterStaking not set");
  }

  if (!address) {
    console.info(colorize(Color.blue, `Deploy XterStakeDelegator`));
    await infoAboutDeployer(hre, deployer);
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`=========================================================`);
    console.info(`============ Deploy XterStakeDelegator ==================`);
    console.info(`=========================================================`);
    const XterStakeDelegator = await deployXterStakeDelegator(whitelistClaimERC20, xterStaking)

    address = await XterStakeDelegator.getAddress();
    console.info(`XterStakeDelegator @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/staking/XterStakeDelegator.sol:XterStakeDelegator",
        constructorArguments: [whitelistClaimERC20, xterStaking],
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
