import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployMarketplaceV2 } from "../../lib/deploy";
import { ContractOrAddrName, getAddressForNetwork } from "../../lib/constant";

const main = async () => {
  const [admin] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let verifyAddress = process.env.verifyAddress;
  const gatewayAddress = getAddressForNetwork(ContractOrAddrName.TokenGateway, hre.network.name);
  const serviceFeeRecipient = process.env.serviceFeeRecipient || admin.address;
  const owner = process.env.owner || getAddressForNetwork(ContractOrAddrName.SafeManager, hre.network.name);

  if (!verifyAddress) {
    console.info(colorize(Color.blue, `Deploy Marketplace`));
    console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${admin.address}`));
    console.info(colorize(Color.yellow, `TokenGateway: ${gatewayAddress}`));
    console.info(colorize(Color.yellow, `Service Fee Recipient: ${serviceFeeRecipient}`));
    if (!owner) {
      console.info(colorize(Color.red, `Owner will by default be the same as the Deployer`));
    } else {
      console.info(colorize(Color.yellow, `Owner: ${owner}`));
    }
    if (!inputConfirm("Confirm? ")) {
      console.warn("Abort");
      return;
    }

    console.info(`============================================================`);
    console.info(`===================== Deploy Marketplace =====================`);
    console.info(`============================================================`);
    const marketplace = await deployMarketplaceV2(gatewayAddress, serviceFeeRecipient);
    const proxyAddress = await marketplace.getAddress();
    console.info(`MarketplaceV2 proxy @ ${proxyAddress}`);

    const implAddress = await hre.upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.info(`MarketplaceV2 impl @ ${implAddress}`);

    verifyAddress = proxyAddress;

    if (owner) {
      console.info(`Transfer ownership to ${owner} ...`);
      await marketplace.transferOwnership(owner);
      console.info(`Ownership Transferred`);
    }
  }

  if (!skipVerify) {
    try {
      await hre.run("verify:verify", {
        address: verifyAddress,
        contract: "contracts/nft-marketplace/MarketplaceV2.sol:MarketplaceV2",
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
