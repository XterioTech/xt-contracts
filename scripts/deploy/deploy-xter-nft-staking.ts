import hre from "hardhat";
import { Color, colorize, infoAboutDeployer } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployXterNFTStaking } from "../../lib/deploy";
import { ContractOrAddrName } from "../../lib/constant";
import { getAddressForNetwork } from "../../lib/constant";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let verifyAddress = process.env.verifyAddress;
  const admin = process.env.admin || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);

  if (!verifyAddress) {
    console.info(colorize(Color.blue, `Deploy XterNFTStaking`));
    await infoAboutDeployer(hre, deployer);
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`=========================================================`);
    console.info(`================= Deploy XterNFTStaking =================`);
    console.info(`=========================================================`);
    const XterNFTStaking = await deployXterNFTStaking(admin);

    const proxyAddress = await XterNFTStaking.getAddress();
    console.info(`XterNFTStaking proxy @ ${proxyAddress}`);

    const implAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.info(`XterNFTStaking impl @ ${implAddress}`);
    verifyAddress = proxyAddress;
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: verifyAddress,
        contract: "contracts/staking/XterNFTStaking.sol:XterNFTStaking",
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