import hre from "hardhat";

const main = async () => {
  await hre.run("verify:verify", {
    address: "0xF4ECC1C74D120649f6598C7A217AbaFfdf76Cd4F",
    constructorArguments: [
      "Dino Amber",
      "DAM",
      8,
      "0x7127f0FEaEF8143241A5FaC62aC5b7be02Ef26A9",
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
