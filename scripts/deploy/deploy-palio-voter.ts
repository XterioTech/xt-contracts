import hre from "hardhat";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork, isTestnet } from "../../lib/constant";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployPalioVoter } from "../../lib/deploy";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;
  // const admin = process.env.admin || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);
  const eventStartTime = Number.parseInt(process.env.eventStartTime || "0")
  const palioSignerAddress = process.env.palioSignerAddress;

  if (eventStartTime == 0) {
    throw new Error("eventStartTime not set");
  }
  if (!palioSignerAddress) {
    throw new Error("palioSignerAddress not set");
  }

  if (!address) {
    console.info(colorize(Color.blue, `Deploy PalioVoter`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}`));
    console.info(colorize(Color.yellow, `Event Start Time: ${new Date(eventStartTime * 1000)}`));
    console.info(colorize(Color.yellow, `Palio Signer Address: ${palioSignerAddress}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`========================================================`);
    console.info(`================== Deploy PalioVoter ===================`);
    console.info(`========================================================`);
    const voter = await deployPalioVoter(palioSignerAddress, eventStartTime, getTxOverridesForNetwork(hre.network.name));
    address = await voter.getAddress();
    console.info(`PalioVoter @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/project-specific/palio/PalioVoter.sol:PalioVoter",
        constructorArguments: [palioSignerAddress, eventStartTime],
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
