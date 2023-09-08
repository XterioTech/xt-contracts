import hre from "hardhat";

const main = async () => {
  await hre.run("verify:verify", {
    address: "0xc42F1C6814566Cf5Ae10f268E9339E4f97C622ee",
    constructorArguments: [
      "MechPal NFT",
      "MECHPAL",
      "https://api.xterio.net/asset/nft/meta/opbnb_testnet",
      "0x5d3757bC0f724aA4332DCa2184edA1b8a94eA0b6", // "0xC8d6b1D3Cca37952465086D9D96DB0E1C96f4E1e",
      "0x3994FfB545A10F189F9C0Ed1a58f0e1D23f22364", // "0x62d49Da6233962e7BEd1C3E9dA3e56739b014c42",
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
