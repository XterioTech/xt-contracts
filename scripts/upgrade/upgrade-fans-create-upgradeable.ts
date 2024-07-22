import hre from "hardhat";
import { colorize, Color, infoAboutDeployer } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { FansCreateBNBUpgradeable } from "../../typechain-types";

const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  const proxyAddress = process.env.PROXY_ADDRESS;

  if (!proxyAddress) {
    console.error(colorize(Color.red, "Please set PROXY_ADDRESS environment variable"));
    return;
  }

  console.info(colorize(Color.blue, `Upgrade FansCreateBNBUpgradeable`));
  await infoAboutDeployer(hre, deployer);
  console.info(colorize(Color.yellow, `Proxy Address: ${proxyAddress}`));

  if (!inputConfirm("Confirm upgrade? ")) {
    console.warn("Abort");
    return;
  }

  console.info(`============================================================`);
  console.info(`========== Upgrading FansCreateBNBUpgradeable ==============`);
  console.info(`============================================================`);

  const FansCreateBNBUpgradeable = await hre.ethers.getContractFactory("FansCreateBNBUpgradeable");

  console.info("Upgrading proxy...");
  const upgradedProxy = await hre.upgrades.upgradeProxy(proxyAddress, FansCreateBNBUpgradeable);

  await upgradedProxy.waitForDeployment();

  const newImplAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.info(colorize(Color.green, `Upgrade successful!`));
  console.info(`New implementation address: ${newImplAddress}`);

  if (!process.env.skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: newImplAddress,
        contract: "contracts/fans-create-upgradeable/FansCreateBNBUpgradeable.sol:FansCreateBNBUpgradeable",
      });
      console.info(colorize(Color.green, `New implementation contract verified successfully`));
    } catch (e) {
      console.warn(colorize(Color.red, `Verification failed: ${e}`));
    }
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });