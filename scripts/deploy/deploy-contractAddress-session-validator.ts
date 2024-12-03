import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork } from "../../lib/constant";
import { NonPayableOverrides } from "../../typechain-types/common";

const deployContractAddressSessionValidationModule = async (
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const ContractAddressSessionValidationModule = await hre.ethers.getContractFactory("ContractAddressSessionValidationModule");
  const token = await ContractAddressSessionValidationModule.deploy(txOverrides || {});
  await token.waitForDeployment();
  return token;
};

const main = async () => {
  const [admin] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;

  if (!address) {
    console.info(colorize(Color.blue, `Deploy ContractAddressSessionValidationModule`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${admin.address}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`=================================================================================`);
    console.info(`================= Deploy ContractAddressSessionValidationModule =================`);
    console.info(`=================================================================================`);
    const ContractAddressSessionValidationModule = await deployContractAddressSessionValidationModule(getTxOverridesForNetwork(hre.network.name));

    address = await ContractAddressSessionValidationModule.getAddress();
    console.info(`ContractAddressSessionValidationModule @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/aa/ContractAddressSessionValidationModule.sol:ContractAddressSessionValidationModule",
        constructorArguments: [],
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
