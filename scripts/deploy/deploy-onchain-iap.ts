import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployOnchainIAP } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork } from "../../lib/constant";

const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  let address = process.env.verifyAddress;
  const skipVerify = process.env.skipVerify || false;
  const admin = process.env.admin || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);

  if (!address) {
    console.info(colorize(Color.blue, `Deploy OnchainIAP`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}`));
    console.info(colorize(Color.yellow, `Admin: ${admin}`));

    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`=========================================================`);
    console.info(`===================== Deploy OnchainIAP =================`);
    console.info(`=========================================================`);
    const OnchainIAP = await deployOnchainIAP(admin, getTxOverridesForNetwork(hre.network.name));
    address = await OnchainIAP.getAddress();
    console.info(`OnchainIAP @ ${address}`);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/onchain-iap/OnchainIAP.sol:OnchainIAP",
        constructorArguments: [admin],
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
