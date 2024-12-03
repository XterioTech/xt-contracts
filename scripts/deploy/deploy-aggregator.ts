import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployAggregator } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork, isTestnet } from "../../lib/constant";

const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  let address = process.env.verifyAddress;
  const skipVerify = process.env.skipVerify || false;
  const owner = process.env.owner || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);
  const decimals = parseInt(process.env.decimals || "-1");
  const version = 1;
  const description = process.env.description || "";

  if (decimals < 0) {
    throw new Error("decimals not specified");
  }

  if (!address) {
    console.info(colorize(Color.blue, `Deploy Aggregator`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}`));
    console.info(colorize(Color.yellow, `Owner: ${owner}`));
    console.info(colorize(Color.yellow, `Decimals: ${decimals}`));
    console.info(colorize(Color.yellow, `Description: ${description}`));

    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`=========================================================`);
    console.info(`===================== Deploy Aggregator =================`);
    console.info(`=========================================================`);
    const Aggregator = await deployAggregator(
      owner,
      decimals,
      description,
      version,
      getTxOverridesForNetwork(hre.network.name)
    );
    address = await Aggregator.getAddress();
    console.info(`Aggregator @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/onchain-iap/Aggregator.sol:Aggregator",
        constructorArguments: [owner, decimals, description, version],
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
