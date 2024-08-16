import hre from "hardhat";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";

const main = async () => {
  const onchainIAP = await hre.helpers.loadOnchainIAP();

  const productId = 1;
  const priceDecimals = 6;
  const paymentRecipient = "0xD86864908d62d2fA38f24707f97A2570967999C3";

  const tokenDecimals = 8;
  const skus = [
    {
      price: "5",
      amount: "3000",
    },
    {
      price: "10",
      amount: "6500",
    },
    {
      price: "20",
      amount: "14000",
    },
    {
      price: "50",
      amount: "36000",
    },
    {
      price: "100",
      amount: "75000",
    },
    {
      price: "500",
      amount: "400000",
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
    console.info(colorize(Color.yellow, ` \t${i + 1}\t${price}\t${amount}`));
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
    const tx = await onchainIAP.registerSKU(
      productId,
      i + 1,
      hre.ethers.parseUnits(price, priceDecimals),
      hre.ethers.parseUnits(amount, tokenDecimals)
    );
    console.info(`Register SKU #${i+1} TX: ${tx.hash}`);
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
