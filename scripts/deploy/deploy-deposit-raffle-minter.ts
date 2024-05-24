import hre, { ethers } from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployDepositRaffleMinter } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork, isTestnet } from "../../lib/constant";

const main = async () => {
  const [deployer] = await hre.ethers.getSigners();
  let address = process.env.verifyAddress;
  const skipVerify = process.env.skipVerify || false;
  const admin = process.env.admin || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);
  const nftAddress = process.env.nftAddress;
  const auctionStartTime = Number.parseInt(process.env.auctionStartTime || "0")
  const auctionEndTime = Number.parseInt(process.env.auctionEndTime || "0")
  const paymentRecipient = process.env.paymentRecipient;
  const unitPrice = process.env.unitPrice
  const maxShare = process.env.maxShare
  const nftPrice = process.env.nftPrice
  const nftAmount = process.env.nftAmount

  if (!nftAddress) {
    throw new Error("nftAddress not set");
  }
  if (auctionStartTime == 0) {
    throw new Error("auctionEndTime not set");
  }
  if (auctionEndTime == 0) {
    throw new Error("auctionEndTime not set");
  }
  if (!paymentRecipient) {
    throw new Error("paymentRecipient not set");
  }
  if (!unitPrice) {
    throw new Error("unitPrice not set");
  }
  if (!maxShare) {
    throw new Error("maxShare not set");
  }
  if (!nftPrice) {
    throw new Error("nftPrice not set");
  }
  if (!nftAmount) {
    throw new Error("nftAmount not set");
  }
  const unitPriceRaw = ethers.parseEther(unitPrice);
  const nftPriceRaw = ethers.parseEther(nftPrice);
  const gatewayAddress = getAddressForNetwork(ContractOrAddrName.TokenGateway, hre.network.name);

  if (!address) {
    console.info(colorize(Color.blue, `Deploy DepositMinter`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}`));
    console.info(colorize(Color.yellow, `Admin: ${admin}`));
    console.info(colorize(Color.yellow, `TokenGateway: ${gatewayAddress}`));
    console.info(colorize(Color.yellow, `NFT Address: ${nftAddress}`));
    console.info(colorize(Color.yellow, `Auction Start Time: ${new Date(auctionStartTime * 1000)}`));
    console.info(colorize(Color.yellow, `Auction End Time: ${new Date(auctionEndTime * 1000)}`));
    console.info(colorize(Color.yellow, `Payment Recipient: ${paymentRecipient}`));
    console.info(colorize(Color.yellow, `unitPrice in ether: ${unitPrice}`));
    console.info(colorize(Color.yellow, `maxShare: ${maxShare}`));
    console.info(colorize(Color.yellow, `nftPrice in ether: ${nftPrice}`));
    console.info(colorize(Color.yellow, `nftAmount: ${nftAmount}`));

    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`========== Deploy deployDepositRaffleMinter ================`);
    console.info(`============================================================`);
    const DepositRaffleMinter = await deployDepositRaffleMinter(
      admin, gatewayAddress, nftAddress, paymentRecipient, auctionStartTime, auctionEndTime,
      unitPriceRaw, maxShare, nftPriceRaw, nftAmount,
      getTxOverridesForNetwork(hre.network.name)
    );
    address = await DepositRaffleMinter.getAddress();
    console.info(`DepositRaffleMinter @ ${address}`);

    if (isTestnet(hre.network.name)) {
      console.info("Add DepositRaffleMinter address to TokenGateway's operator whitelist ...");
      const gateway = await hre.ethers.getContractAt("TokenGateway", gatewayAddress);
      await gateway.addOperatorWhitelist(address, getTxOverridesForNetwork(hre.network.name));
    } else {
      // in mainnet, we do this mannually through multisig address
      console.warn(
        colorize(Color.yellow, "Remember to add DepositRaffleMinter address to tokenGateway's operator whitelist")
      );
    }
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/launchpad/DepositRaffleMinter.sol:DepositRaffleMinter",
        constructorArguments: [admin, gatewayAddress, nftAddress, paymentRecipient, auctionStartTime, auctionEndTime, unitPriceRaw, maxShare, nftPriceRaw, nftAmount],
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
