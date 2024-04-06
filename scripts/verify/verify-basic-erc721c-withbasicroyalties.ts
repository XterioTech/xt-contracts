import hre from "hardhat";

const main = async () => {
  await hre.run("verify:verify", {
    address: "0xF4ECC1C74D120649f6598C7A217AbaFfdf76Cd4F",
    constructorArguments: [
      "Age of Dino - Dinosty",
      "DINOSTY",
      "https://api.xter.io/asset/nft/meta/ethereum",
      "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
      "0xeCF63dFBa014dc9CEa2715d10082Bbbc892D2188",
      "0x0EAEf2c5A9c0108593134567dfb1e6655aE13Cb9",
      500
    ],
    contract: "contracts/basic-tokens/BasicERC721CWithBasicRoyalties.sol:BasicERC721CWithBasicRoyalties",
  });
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
