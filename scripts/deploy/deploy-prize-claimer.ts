import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployPrizeClaimer } from "../../lib/deploy";
import { ContractName, getAddressForNetwork } from "../../lib/constant";

const main = async () => {
  const [admin] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;

  const signerAddress = "0x11d2f99D641b1d38d2e1adF1d85f0a3Fec9cb411"
  const scoreNFTAddress = "0x4CaF4cb43C455Ed66E643cB7d59c45b38E66d0D0"

  if (!address) {
    const gatewayAddress = getAddressForNetwork(ContractName.TokenGateway, hre.network.name);
    console.info(colorize(Color.blue, `Deploy PrizeClaimer`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${admin.address}`));
    console.info(colorize(Color.yellow, `TokenGateway: ${gatewayAddress}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`=================== Deploy PrizeClaimer ====================`);
    console.info(`============================================================`);
    const PrizeClaimer = await deployPrizeClaimer(gatewayAddress, signerAddress, scoreNFTAddress);
    address = await PrizeClaimer.getAddress();
    console.info(`PrizeClaimer @ ${address}`);
    console.info("Add operator whitelist in TokenGateway...");
    const gateway = await hre.ethers.getContractAt("TokenGateway", gatewayAddress);
    await gateway.addOperatorWhitelist(address);
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/basic-tokens/PrizeClaimer.sol:PrizeClaimer",
        constructorArguments: [getAddressForNetwork(ContractName.TokenGateway, hre.network.name), signerAddress, scoreNFTAddress],
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
