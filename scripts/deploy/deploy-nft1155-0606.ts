import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork } from "../../lib/constant";
import { NonPayableOverrides } from "../../typechain-types/common";


export const deployNFT1155_0606 = async (
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const NFT1155_0606 = await hre.ethers.getContractFactory("NFT1155_0606");
  const token = await NFT1155_0606.deploy(txOverrides || {});
  await token.waitForDeployment();
  return token;
};

const main = async () => {
  const [admin] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;

  if (!address) {
    console.info(colorize(Color.blue, `Deploy NFT1155_0606`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${admin.address}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`=================== Deploy NFT1155_0606 ===================`);
    console.info(`============================================================`);
    const NFT1155_0606 = await deployNFT1155_0606(getTxOverridesForNetwork(hre.network.name));

    address = await NFT1155_0606.getAddress();
    console.info(`NFT1155_0606 @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/test/NFT1155_0606.sol:NFT1155_0606",
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
