import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployAuctionMinter } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork, isTestnet } from "../../lib/constant";

const nftAddress = '0x27C33D7AC334781000b840d4b5E2AAd8b5158dde'
const nftAmount = 5
const paymentRecipient = '0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26'
const auctionEndTime = 1803058000 // time in s, UTC

const main = async () => {
  const [admin] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;

  const gatewayAddress = getAddressForNetwork(ContractOrAddrName.TokenGateway, hre.network.name);
  if (!address) {
    console.info(colorize(Color.blue, `Deploy AuctionMinter`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${admin.address}`));
    console.info(colorize(Color.yellow, `TokenGateway: ${gatewayAddress}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`===================== Deploy AuctionMinter =================`);
    console.info(`============================================================`);
    const AuctionMinter = await deployAuctionMinter(gatewayAddress, nftAddress, paymentRecipient, nftAmount, auctionEndTime, getTxOverridesForNetwork(hre.network.name));
    address = await AuctionMinter.getAddress();
    console.info(`AuctionMinter @ ${address}`);

    if (isTestnet(hre.network.name)) {
      // console.info("Add operator whitelist in TokenGateway...");
      const gateway = await hre.ethers.getContractAt("TokenGateway", gatewayAddress);
      await gateway.addOperatorWhitelist(address, getTxOverridesForNetwork(hre.network.name));
    } else {
      // in mainnet, we do this mannually through multisig address
      console.warn(
        colorize(Color.yellow, "Remember to add AuctionMinter address to tokenGateway's operator whitelist")
      );
    }
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/nft-auction/AuctionMinter.sol:AuctionMinter",
        constructorArguments: [gatewayAddress, nftAddress, paymentRecipient, nftAmount, auctionEndTime],
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
