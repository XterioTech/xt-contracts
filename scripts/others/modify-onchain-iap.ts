import hre from "hardhat";

const main = async () => {

  const onchainIAP = await hre.helpers.loadOnchainIAP();

  const _productId = 1
  const _skuId = 6
  const _price = hre.ethers.parseUnits('500', 6)
  const _amount = hre.ethers.parseEther('400000')

  console.log("SKU:", _productId, _skuId, hre.ethers.formatUnits(_price, 6), hre.ethers.formatEther(_amount));

  const tx = await onchainIAP.registerSKU(_productId, _skuId, _price, _amount);

  console.log("tx hash:", tx.hash);
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
