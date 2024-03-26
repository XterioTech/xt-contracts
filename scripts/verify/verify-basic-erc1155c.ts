import hre from "hardhat";

const main = async () => {
  await hre.run("verify:verify", {
    address: "0x59c5fb12E3b822cC68873805720B8874Af603DC2",
    constructorArguments: [
      "https://api.xter.io/asset/nft/meta/xterio_testnet",
      "0xB6Fe7Bc1c8836983C0643D5869c42bD27aCAAedD",
      "0xB4c7E393619E0924e6B3dbc718B7e2a29A123529"
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
