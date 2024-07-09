import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployWhitelistClaimETH } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork } from "../../lib/constant";

const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;
  // let admin = process.env.admin || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);
  let claimMerkleRoot = process.env.claimMerkleRoot;
  let claimStartTime = Number.parseInt(process.env.claimStartTime || "0");
  let claimEndTime = Number.parseInt(process.env.claimEndTime || "0");

  if (!claimMerkleRoot) {
    throw new Error("claimMerkleRoot not set");
  }
  if (!claimStartTime) {
    throw new Error("claimStartTime not set");
  }
  if (!claimEndTime) {
    throw new Error("claimEndTime not set");
  }

  if (!address) {
    console.info(colorize(Color.blue, `Deploy WhitelistClaimETH`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}`));
    // console.info(colorize(Color.yellow, `Admin: ${admin}`));
    console.info(colorize(Color.yellow, `Claim Start Time: ${new Date(claimStartTime * 1000)}`));
    console.info(colorize(Color.yellow, `Claim End Time: ${new Date(claimEndTime * 1000)}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`================ Deploy WhitelistClaimETH ==================`);
    console.info(`============================================================`);
    const WhitelistClaimETH = await deployWhitelistClaimETH(
      claimMerkleRoot, claimStartTime, claimEndTime,
      getTxOverridesForNetwork(hre.network.name)
    );
    address = await WhitelistClaimETH.getAddress();
    console.info(`WhitelistClaimETH @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/airdrop/WhitelistClaimETH.sol:WhitelistClaimETH",
        constructorArguments: [claimMerkleRoot, claimStartTime, claimEndTime,],
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
