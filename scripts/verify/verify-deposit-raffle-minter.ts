import hre from "hardhat";

const main = async () => {
  await hre.run("verify:verify", {
    address: "0x9131e8F8ee1Fef30B00B4146017d56B24A30d5e0",
    constructorArguments: [
      "0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26", // address _admin,
      "0xB6Fe7Bc1c8836983C0643D5869c42bD27aCAAedD", // address _gateway,
      "0x41009de01cDD0E3BD907f6778Ad7EF6e062ef576", // address _nftAddress,
      "0xcB907bE1d76b3E7672ea6742ccC5fcDbE9bb3530", // address _paymentRecipient,
      1713758400, // uint256 _auctionStartTime,
      1714363200, // uint256 _auctionEndTime,
      "300000000000000000", // uint256 _unitPrice,
      5, // uint256 _maxShare,
      0, // uint256 _nftPrice,
      945, // uint256 _nftAmount
    ],
    contract: "contracts/launchpad/DepositRaffleMinter.sol:DepositRaffleMinter",
  });
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
