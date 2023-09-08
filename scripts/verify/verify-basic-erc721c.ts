import hre from "hardhat";

const main = async () => {
  await hre.run("verify:verify", {
    address: "0x65393CE80BeC582596687D604AD0B507b8DebFB1",
    constructorArguments: [
      "Basic721C",
      "B721",
      "https://api.playvrs.net/asset/nft/meta/goerli",
      "0xC8d6b1D3Cca37952465086D9D96DB0E1C96f4E1e",
      "0x62d49Da6233962e7BEd1C3E9dA3e56739b014c42",
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
