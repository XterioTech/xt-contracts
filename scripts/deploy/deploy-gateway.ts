import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployGateway } from "../../lib/deploy";

const main = async () => {
  const [admin] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let verifyAddress = process.env.verifyAddress;

  if (!verifyAddress) {
    console.info(colorize(Color.blue, `Deploy TokenGateway`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${admin.address}`));
    if (!inputConfirm("Confirm? (y/N)")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`===================== Deploy TokenGateway =====================`);
    console.info(`============================================================`);
    const gateway = await deployGateway(admin);
    const proxyAddress = await gateway.getAddress();
    console.info(`TokenGateway proxy @ ${proxyAddress}`);

    const implAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.info(`TokenGateway impl @ ${implAddress}`);

    verifyAddress = implAddress;
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: verifyAddress,
        contract: "contracts/basic-tokens/management/TokenGateway.sol:TokenGateway",
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
