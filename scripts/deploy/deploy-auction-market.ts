import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployAuctionMarket } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork, isTestnet } from "../../lib/constant";

const nftAddress = '0x072d78C1F683C40537aa54D6Fa64691bCaD875a2'
const maxCapacity = 5
const auctionStartTime = 1703058 // time in s, UTC

const main = async () => {
  const [admin] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;

  const gatewayAddress = getAddressForNetwork(ContractOrAddrName.TokenGateway, hre.network.name);
  if (!address) {
    console.info(colorize(Color.blue, `Deploy AuctionMarket`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${admin.address}`));
    console.info(colorize(Color.yellow, `TokenGateway: ${gatewayAddress}`));
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`===================== Deploy AuctionMarket =================`);
    console.info(`============================================================`);
    const AuctionMarket = await deployAuctionMarket(gatewayAddress, nftAddress, maxCapacity, auctionStartTime, getTxOverridesForNetwork(hre.network.name));
    address = await AuctionMarket.getAddress();
    console.info(`AuctionMarket @ ${address}`);

    if (isTestnet(hre.network.name)) {
      // console.info("Add operator whitelist in TokenGateway...");
      const gateway = await hre.ethers.getContractAt("TokenGateway", gatewayAddress);
      await gateway.addOperatorWhitelist(address, getTxOverridesForNetwork(hre.network.name));
    } else {
      // in mainnet, we do this mannually through multisig address
      console.warn(
        colorize(Color.yellow, "Remember to add AuctionMarket address to tokenGateway's operator whitelist")
      );
    }
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: address,
        contract: "contracts/nft-auction/AuctionMarket.sol:AuctionMarket",
        constructorArguments: [gatewayAddress, nftAddress, maxCapacity, auctionStartTime],
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
