import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork } from "../../lib/constant";
import { NonPayableOverrides } from "../../typechain-types/common";


const deployERC1155MintToSessionValidationModule = async (
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const ERC1155MintToSessionValidationModule = await hre.ethers.getContractFactory("ERC1155MintToSessionValidationModule");
  const token = await ERC1155MintToSessionValidationModule.deploy(txOverrides || {});
  await token.waitForDeployment();
  return token;
};

const main = async () => {
  const [admin] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;

  if (!address) {
    console.info(colorize(Color.blue, `Deploy ERC1155MintToSessionValidationModule`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${admin.address}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`=================================================================================`);
    console.info(`=================== Deploy ERC1155MintToSessionValidationModule =================`);
    console.info(`=================================================================================`);
    const ERC1155MintToSessionValidationModule = await deployERC1155MintToSessionValidationModule(getTxOverridesForNetwork(hre.network.name));

    address = await ERC1155MintToSessionValidationModule.getAddress();
    console.info(`ERC1155MintToSessionValidationModule @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/aa/ERC1155MintToSessionValidationModule.sol:ERC1155MintToSessionValidationModule",
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
