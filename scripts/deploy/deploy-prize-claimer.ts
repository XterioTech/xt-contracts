import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";
import { deployPrizeClaimer } from "../../lib/deploy-aod";
import { ContractOrAddrName, getAddressForNetwork, getTxOverridesForNetwork } from "../../lib/constant";

const main = async () => {
  const [admin] = await hre.ethers.getSigners();
  let skipVerify = process.env.skipVerify || false;
  let address = process.env.verifyAddress;
  // address = "0x7d05C044A18eF22EAbbFa9419d907ef00364c1e9"

  // TODO
  const signerAddress = "0x204983A2f4d9C1B893572fe8DFcdCF485F4893B3"
  const payeeAddress = "0xfc7Ee59fdaB8875a2b2a2d5173172ff12af6e45a"
  const hammerNFTAddress = "0x37db14B0CC1e517C6Dbdfa60aecE4a045185548E"
  const dogtagNFTAddress = "0x09Baf813EFDc01E33b9b90D7059c155FDbd403Cf"

  if (!address) {
    const gatewayAddress = getAddressForNetwork(ContractOrAddrName.TokenGateway, hre.network.name);
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
    const PrizeClaimer = await deployPrizeClaimer(admin.address, gatewayAddress, signerAddress, payeeAddress, hammerNFTAddress, dogtagNFTAddress, getTxOverridesForNetwork(hre.network.name));
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
        contract: "contracts/project-specific/aod/PrizeClaimer.sol:PrizeClaimer",
        constructorArguments: [admin.address, getAddressForNetwork(ContractOrAddrName.TokenGateway, hre.network.name), signerAddress, payeeAddress, hammerNFTAddress, dogtagNFTAddress],
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
