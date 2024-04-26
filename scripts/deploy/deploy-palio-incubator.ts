import hre from "hardhat";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork, isTestnet } from "../../lib/constant";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployPalioIncubator } from "../../lib/deploy";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;
  const admin = process.env.admin || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);
  const eventStartTime = Number.parseInt(process.env.eventStartTime || "0")
  const eggAddress = process.env.eggAddress;
  const chatNFTAddress = process.env.chatNFTAddress;
  const payeeAddress = process.env.payeeAddress;
  const gatewayAddress = getAddressForNetwork(ContractOrAddrName.TokenGateway, hre.network.name);

  if (eventStartTime == 0) {
    throw new Error("eventStartTime not set");
  }
  if (!payeeAddress) {
    throw new Error("payeeAddress not set");
  }
  if (!eggAddress) {
    throw new Error("eggAddress not set");
  }
  if (!chatNFTAddress) {
    throw new Error("chatNFTAddress not set");
  }

  if (!address) {
    console.info(colorize(Color.blue, `Deploy PalioIncubator`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}`));
    console.info(colorize(Color.yellow, `Event Start Time: ${new Date(eventStartTime * 1000)}`));
    console.info(colorize(Color.yellow, `Egg Address: ${eggAddress}`));
    console.info(colorize(Color.yellow, `Chat NFT Address: ${chatNFTAddress}`));
    console.info(colorize(Color.yellow, `Payee Address: ${payeeAddress}`));

    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`================== Deploy PalioIncubator ===================`);
    console.info(`============================================================`);
    const incubator = await deployPalioIncubator(gatewayAddress, payeeAddress, eggAddress, chatNFTAddress, eventStartTime, getTxOverridesForNetwork(hre.network.name));
    address = await incubator.getAddress();
    console.info(`PalioIncubator @ ${address}`);

    if (isTestnet(hre.network.name)) {
      console.info("Add PalioIncubator address to TokenGateway's operator whitelist ...");
      const gateway = await hre.ethers.getContractAt("TokenGateway", gatewayAddress);
      await gateway.addOperatorWhitelist(address, getTxOverridesForNetwork(hre.network.name));
    } else {
      // in mainnet, we do this mannually through multisig address
      console.warn(
        colorize(Color.yellow, "Remember to add PalioIncubator address to tokenGateway's operator whitelist")
      );
    }
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/project-specific/palio/PalioIncubator.sol:PalioIncubator",
        constructorArguments: [gatewayAddress, payeeAddress, eggAddress, chatNFTAddress, eventStartTime],
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
