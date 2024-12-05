import hre from "hardhat";
import { Color, colorize, infoAboutDeployer } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployAiCampaign } from "../../lib/deploy";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;
  const eventStartTime = Number.parseInt(process.env.eventStartTime || "0")

  if (eventStartTime <= 0) {
    throw new Error("eventStartTime not specified");
  }

  if (!address) {
    console.info(colorize(Color.blue, `Deploy AiCampaign`));
    await infoAboutDeployer(hre, deployer);
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`=========================================================`);
    console.info(`================= Deploy AiCampaign =====================`);
    console.info(`=========================================================`);
    const AiCampaign = await deployAiCampaign(eventStartTime)
    address = await AiCampaign.getAddress();
    console.info(`AiCampaign @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/ai-campaign/AiCampaign.sol:AiCampaign",
        constructorArguments: [eventStartTime],
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
