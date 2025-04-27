import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployLaunchpool } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork } from "../../lib/constant";

const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  let address = process.env.verifyAddress;
  const skipVerify = process.env.skipVerify || false;

  const owner = process.env.owner || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);
  const stakeToken = process.env.stakeToken || getAddressForNetwork(ContractOrAddrName.XterToken, hre.network.name);
  const rewardToken = process.env.rewardToken || hre.ethers.ZeroAddress;
  const startTime = Number.parseInt(process.env.startTime || "0");
  const duration = Number.parseInt(process.env.duration || "0");
  const rewardAmount = process.env.rewardAmount;
  const poolStakeLimit = process.env.poolStakeLimit;
  const userStakeLimit = process.env.userStakeLimit;

  // fetch decimals for stakeToken and rewardToken
  const stakeTokenContract = await hre.ethers.getContractAt("ERC20", stakeToken);
  const stakeTokenDecimals = await stakeTokenContract.decimals();
  let rewardTokenDecimals;
  if (rewardToken == hre.ethers.ZeroAddress) {
    // reward on another chain, specify the decimals mannually
    rewardTokenDecimals = Number.parseInt(process.env.rewardTokenDecimals || "0")
    if (!rewardTokenDecimals) {
      throw new Error("rewardTokenDecimals not set");
    }
  } else {
    const rewardTokenContract = await hre.ethers.getContractAt("ERC20", rewardToken);
    rewardTokenDecimals = await rewardTokenContract.decimals();
  }

  if (!startTime) {
    throw new Error("startTime not set");
  }
  if (!duration) {
    throw new Error("duration not set");
  }
  if (!rewardAmount) {
    throw new Error("rewardAmount not set");
  }
  if (!poolStakeLimit) {
    throw new Error("poolStakeLimit not set");
  }
  if (!userStakeLimit) {
    throw new Error("userStakeLimit not set");
  }

  const rewardAmountRaw = hre.ethers.parseUnits(rewardAmount, rewardTokenDecimals);
  const poolStakeLimitRaw = hre.ethers.parseUnits(poolStakeLimit, stakeTokenDecimals);
  const userStakeLimitRaw = hre.ethers.parseUnits(userStakeLimit, stakeTokenDecimals);

  if (!address) {
    console.info(colorize(Color.blue, `Deploy Launchpool`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}`));
    console.info(colorize(Color.yellow, `Owner: ${owner}`));
    console.info(colorize(Color.yellow, `stakeToken: ${stakeToken}`));
    console.info(colorize(Color.yellow, `rewardToken: ${rewardToken}`));
    console.info(colorize(Color.yellow, `startTime: ${new Date(startTime * 1000)}`));
    console.info(colorize(Color.yellow, `endTime: ${new Date((startTime + duration) * 1000)}`));
    console.info(colorize(Color.yellow, `duration: ${duration}`));
    console.info(colorize(Color.yellow, `rewardAmount: ${rewardAmount}, raw: ${rewardAmountRaw.toString()}`));
    console.info(colorize(Color.yellow, `poolStakeLimit: ${poolStakeLimit}, raw: ${poolStakeLimitRaw.toString()}`));
    console.info(colorize(Color.yellow, `userStakeLimit: ${userStakeLimit}, raw: ${userStakeLimitRaw.toString()}`));

    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`=========================================================`);
    console.info(`===================== Deploy Launchpool =================`);
    console.info(`=========================================================`);
    const Launchpool = await deployLaunchpool(
      owner,
      stakeToken,
      rewardToken,
      startTime,
      duration,
      rewardAmountRaw,
      poolStakeLimitRaw,
      userStakeLimitRaw,
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
        constructorArguments: [owner, stakeToken, rewardToken, startTime, duration, rewardAmountRaw, poolStakeLimitRaw, userStakeLimitRaw],
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
