import hre from "hardhat";

const main = async () => {
  await hre.run("verify:verify", {
    address: "0xFdF5aCd92840E796955736B1BB9CC832740744Ba",
    constructorArguments: [
      "OVERWORLD INCARNA",
      "INCARNA",
      "https://api.xter.io/asset/nft/meta/ethereum",
      "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
      "0xeCF63dFBa014dc9CEa2715d10082Bbbc892D2188",
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
