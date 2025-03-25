import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployUniswapV3Aggregator } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork, isTestnet } from "../../lib/constant";

const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  let address = process.env.verifyAddress;
  const skipVerify = process.env.skipVerify || false;
  const owner = process.env.owner || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);
  const uniswapV3Pool = process.env.uniswapV3Pool || "";
  const decimals = parseInt(process.env.decimals || "6");
  const version = 1;
  const description = process.env.description || "";

  if (!address) {
    console.info(colorize(Color.blue, `Deploy UniswapV3Aggregator`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}`));
    console.info(colorize(Color.yellow, `uniswapV3Pool: ${uniswapV3Pool}`));
    console.info(colorize(Color.yellow, `Owner: ${owner}`));
    console.info(colorize(Color.yellow, `Decimals: ${decimals}`));
    console.info(colorize(Color.yellow, `Description: ${description}`));

    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`=========================================================`);
    console.info(`===================== Deploy UniswapV3Aggregator =================`);
    console.info(`=========================================================`);
    const UniswapV3Aggregator = await deployUniswapV3Aggregator(
      uniswapV3Pool,
      owner,
      decimals,
      description,
      version,
      getTxOverridesForNetwork(hre.network.name)
    );
    address = await UniswapV3Aggregator.getAddress();
    console.info(`UniswapV3Aggregator @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/onchain-iap/UniswapV3Aggregator.sol:UniswapV3Aggregator",
        constructorArguments: [uniswapV3Pool, owner, decimals, description, version,],
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
