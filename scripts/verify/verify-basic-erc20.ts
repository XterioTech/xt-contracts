import hre from "hardhat";

const main = async () => {
  await hre.run("verify:verify", {
    address: "0x94F8D460A89949044acaa0a3dc6991AAbEBDC688",
    constructorArguments: [
      "Dino Bucks",
      "DB",
      8,
      "0x7127f0feaef8143241a5fac62ac5b7be02ef26a9",
      "0xeCF63dFBa014dc9CEa2715d10082Bbbc892D2188",
    ],
    contract: "contracts/basic-tokens/BasicERC20.sol:BasicERC20",
  });
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
