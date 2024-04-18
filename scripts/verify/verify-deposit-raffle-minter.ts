import hre from "hardhat";

const main = async () => {
  await hre.run("verify:verify", {
    address: "0x32cF51D61247E787E61cA956bec3cA4e5c345B6a",
    constructorArguments: [
      "0x6F272C3b23Fc0525b6696aF4405434c3c10C7c26", // address _admin,
      "0xB6Fe7Bc1c8836983C0643D5869c42bD27aCAAedD", // address _gateway,
      "0x015C1E162b632EeF0845431a8B21061CAEbC0EEe", // address _nftAddress,
      "0x1371485360c7F5B8336db38A446C5fD8cf084243", // address _paymentRecipient,
      1713427200, // uint256 _auctionStartTime,
      1713499200, // uint256 _auctionEndTime,
      "10000000000000000", // uint256 _unitPrice,
      5, // uint256 _maxShare,
      0, // uint256 _nftPrice,
      10, // uint256 _nftAmount
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
