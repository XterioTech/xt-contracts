import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployLaunchpool } from "../../lib/deploy";
import { getTxOverridesForNetwork } from "../../lib/constant";

const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  let address = process.env.verifyAddress;
  const skipVerify = process.env.skipVerify || false;

  const owner = process.env.owner || "";
  const stakingToken = process.env.stakingToken || "";
  const rewardsToken = process.env.rewardsToken || hre.ethers.ZeroAddress;
  const startTime = process.env.startTime || "2692873314";
  const duration = process.env.duration || "1";
  const rewardAmount = process.env.rewardAmount || "1";
  const poolStakeLimit = process.env.poolStakeLimit || "1";
  const userStakeLimit = process.env.userStakeLimit || "1";

  if (!address) {
    console.info(colorize(Color.blue, `Deploy Launchpool`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}`));
    console.info(colorize(Color.yellow, `Owner: ${owner}`));
    console.info(colorize(Color.yellow, `stakingToken: ${stakingToken}`));
    console.info(colorize(Color.yellow, `rewardsToken: ${rewardsToken}`));
    console.info(colorize(Color.yellow, `startTime: ${startTime}`));
    console.info(colorize(Color.yellow, `duration: ${duration}`));
    console.info(colorize(Color.yellow, `rewardAmount: ${rewardAmount}`));
    console.info(colorize(Color.yellow, `poolStakeLimit: ${poolStakeLimit}`));
    console.info(colorize(Color.yellow, `userStakeLimit: ${userStakeLimit}`));

    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`=========================================================`);
    console.info(`===================== Deploy Launchpool =================`);
    console.info(`=========================================================`);
    const Launchpool = await deployLaunchpool(
      owner,
      stakingToken,
      rewardsToken,
      startTime,
      duration,
      rewardAmount,
      poolStakeLimit,
      userStakeLimit,
      getTxOverridesForNetwork(hre.network.name)
    );

    address = await Launchpool.getAddress();
    console.info(`Launchpool @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/launchpool/Launchpool.sol:Launchpool",
        constructorArguments: [owner, stakingToken, rewardsToken, startTime, duration, rewardAmount, poolStakeLimit, userStakeLimit],
      });
    } catch (e) {
      console.warn(`Verify failed: ${e}`);
    }
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
