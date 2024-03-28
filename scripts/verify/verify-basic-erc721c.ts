import hre from "hardhat";
import { ContractOrAddrName, getAddressForNetwork } from "../../lib/constant";

const main = async () => {
  await hre.run("verify:verify", {
    address: "0xb7E548C4f133AdBB910914D7529D5CB00c2E9051",
    constructorArguments: [
      "PalioAI START",
      "PAS",
      "https://api.xter.io/asset/nft/meta/xterio",
      "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
      "0xeCF63dFBa014dc9CEa2715d10082Bbbc892D2188",
      0
    ],
    contract: "contracts/basic-tokens/BasicERC721C.sol:BasicERC721C",
  });
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
