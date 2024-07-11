import hre from "hardhat";
import { getTxOverridesForNetwork } from "../../lib/constant";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { NonPayableOverrides } from "../../typechain-types/common";

const deployTestERC20 = async (
    name: string, symbol: string, decimals: number,
    txOverrides?: NonPayableOverrides & { from?: string }
  ) => {
    const Contract = await hre.ethers.getContractFactory("TestERC20");
    const contract = await Contract.deploy(name, symbol, decimals, txOverrides || {})
    await contract.waitForDeployment();
    return contract;
  };

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;
  const name = process.env.name;
  const symbol = process.env.symbol;
  const decimals = Number.parseInt(process.env.decimals || "-1");

  if (!name) {
    throw new Error("name not set");
  }
  if (!symbol) {
    throw new Error("symbol not set");
  }
  if (decimals < 0) {
    throw new Error("decimals not set");
  }

  if (!address) {
    console.info(colorize(Color.blue, `Deploy TestERC20`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}`));
    console.info(colorize(Color.yellow, `Token Name: ${name}`));
    console.info(colorize(Color.yellow, `Token Symbol: ${symbol}`));
    console.info(colorize(Color.yellow, `Token Decimals: ${decimals}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`===================== Deploy TestERC20 =====================`);
    console.info(`============================================================`);
    const tk = await deployTestERC20(name, symbol, decimals, getTxOverridesForNetwork(hre.network.name));
    address = await tk.getAddress();
    console.info(`TestERC20 @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/test/TestERC20.sol:TestERC20",
        constructorArguments: [name, symbol, decimals],
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
