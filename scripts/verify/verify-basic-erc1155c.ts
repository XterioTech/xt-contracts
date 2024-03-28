import hre from "hardhat";

const main = async () => {
  await hre.run("verify:verify", {
    address: "0xa90319054b3210e9a81740D8e8520c4D52B428d4",
    constructorArguments: [
      "https://api.xter.io/asset/nft/meta/xterio",
      "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
      "0xeCF63dFBa014dc9CEa2715d10082Bbbc892D2188"
    ],
    contract: "contracts/basic-tokens/BasicERC1155C.sol:BasicERC1155C",
  });
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
