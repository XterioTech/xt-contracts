import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployAggregator } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork, isTestnet } from "../../lib/constant";

const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  let address = process.env.verifyAddress;
  const skipVerify = process.env.skipVerify || false;
  const admin = process.env.admin || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);

  // ToDo...
  const decimals = 8;
  const description = "XTER Custom Price Feed";
  const version = 1;

  if (!address) {
    console.info(colorize(Color.blue, `Deploy Aggregator`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}`));
    console.info(colorize(Color.yellow, `Admin: ${admin}`));

    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`=========================================================`);
    console.info(`===================== Deploy Aggregator =================`);
    console.info(`=========================================================`);
    const Aggregator = await deployAggregator(admin, decimals, description, version, getTxOverridesForNetwork(hre.network.name));
    address = await Aggregator.getAddress();
    console.info(`Aggregator @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/onchain-iap/Aggregator.sol:Aggregator",
        constructorArguments: [admin, decimals, description, version],
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
