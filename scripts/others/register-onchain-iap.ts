import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";

const idxToSkuId = (id: number) => {
  return id + 1001
}

const main = async () => {
  const onchainIAP = await hre.helpers.loadOnchainIAP();

  const productId = 2;
  const priceDecimals = 6;
  const paymentRecipient = process.env.paymentRecipient;

  if (!paymentRecipient) {
    throw new Error("paymentRecipient not set");
    
  }

  const tokenDecimals = 0;
  const skus = [
    {
      price: "1.99",
      amount: "257",
    },
    {
      price: "4.99",
      amount: "660",
    },
    {
      price: "12.99",
      amount: "1800",
    },
    {
      price: "29.99",
      amount: "4320",
    },
    {
      price: "39.99",
      amount: "6300",
    },
    {
      price: "99.99",
      amount: "18000",
    },
  ];

  console.info(colorize(Color.blue, `Register Product and SKUs`));
  console.info(colorize(Color.yellow, `Network: ${hre.network.name}`));
  console.info(colorize(Color.yellow, `OnchainIAP: ${onchainIAP.target}`));
  console.info(colorize(Color.yellow, `Product ID: ${productId}`));
  console.info(colorize(Color.yellow, `Product Price Decimals: ${priceDecimals}`));
  console.info(colorize(Color.yellow, `Product Token Decimals: ${tokenDecimals}`));
  console.info(colorize(Color.yellow, `Product Payment Recipient: ${paymentRecipient}`));
  console.info(colorize(Color.yellow, "\nSKUs:\tID\tPrice\tAmount"));
  for (let i = 0; i < skus.length; i++) {
    const { price, amount } = skus[i];
    console.info(colorize(Color.yellow, ` \t${idxToSkuId(i)}\t${price}\t${amount}`));
  }

  if (!inputConfirm("Confirm? ")) {
    console.warn("Abort");
    return;
  }

  console.info(`=========================================================`);
  console.info(`================= Register Product and SKUs =============`);
  console.info(`=========================================================`);
  const tx1 = await onchainIAP.registerProduct(productId, priceDecimals, paymentRecipient);
  console.info(`Register Product TX: ${tx1.hash}`);
  await tx1.wait();

  for (let i = 0; i < skus.length; i++) {
    const { price, amount } = skus[i];
    const skuId = idxToSkuId(i);
    const tx = await onchainIAP.registerSKU(
      productId,
      skuId,
      hre.ethers.parseUnits(price, priceDecimals),
      hre.ethers.parseUnits(amount, tokenDecimals)
    );
    console.info(`Register SKU #${skuId} TX: ${tx.hash}`);
    await tx.wait();
  }

};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
