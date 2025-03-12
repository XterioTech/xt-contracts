import hre from "hardhat";
import { Color, colorize, infoAboutDeployer } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    let skipVerify = process.env.skipVerify || false;

    console.info(colorize(Color.blue, `Deploy XterStaking Impl`));
    await infoAboutDeployer(hre, deployer);
    if (!inputConfirm("Confirm? ")) {
        console.warn("Abort");
        return;
    }

    console.info(`=========================================================`);
    console.info(`================= Deploy XterStaking Impl ====================`);
    console.info(`=========================================================`);
    const xterStakingContractFactory = await hre.ethers.getContractFactory("XterStaking");
    const xterStakingInstance = await xterStakingContractFactory.deploy();
    console.info(`XterStaking impl @ ${xterStakingInstance.target}`);
    const upgradeToCallData = xterStakingContractFactory.interface.encodeFunctionData("upgradeTo", [xterStakingInstance.target]);
    console.log("XterStaking upgradeTo function calldata is", upgradeToCallData);

    if (!skipVerify) {
        try {
            await hre.run("verify:verify", {
                address: xterStakingInstance.target,
                contract: "contracts/staking/XterStaking.sol:XterStaking",
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
