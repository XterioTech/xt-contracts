import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployCheckIn } from "../../lib/deploy";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;
  let startTime = Number.parseInt(process.env.checkInStartTime || "0");

  if (!address) {
    console.info(colorize(Color.blue, `Deploy CheckIn`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}`));
    console.info(colorize(Color.yellow, `Checkin Start Time: ${new Date(startTime * 1000)}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`===================== Deploy CheckIn =====================`);
    console.info(`============================================================`);
    const checkIn = await deployCheckIn(Number(startTime))
    address = await checkIn.getAddress();
    console.info(`CheckIn @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/checkIn/CheckIn.sol:CheckInContract",
        constructorArguments: [startTime],
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
