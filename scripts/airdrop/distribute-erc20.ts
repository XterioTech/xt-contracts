import hre from "hardhat";
import { ethers } from "ethers";
import Distribute_ABI from "./abi/Distribute.json";
import ERC20_ABI from "./abi/ERC20.json";
import { readFromCSV } from "./utils/csv-to-string";
import { DISTRIBUTER } from "./constants/address";
import { logAndWaitTx } from "./utils/logger";
import { Color, colorize } from "../../lib/utils";
import { inputConfirm } from "../../lib/input";

async function distributeERC20(tokenAddress: string, recipients: string[], amounts: number[], decimals: number) {
  const provider = hre.ethers.provider;
  const [signer] = await hre.ethers.getSigners();
  const distributer = new ethers.Contract(DISTRIBUTER[hre.network.name], Distribute_ABI, signer);

  let gas, feeData, tx;

  [gas, feeData] = await Promise.all([
    distributer.distributeTokens.estimateGas(tokenAddress, recipients, amounts, decimals, ethers.ZeroAddress),
    provider.getFeeData(),
  ]);

  tx = await distributer.distributeTokens(tokenAddress, recipients, amounts, decimals, ethers.ZeroAddress, {
    gasPrice: (BigInt(feeData.gasPrice ?? 0) * BigInt(12)) / BigInt(10),
    gasLimit: (BigInt(gas) * BigInt(12)) / BigInt(10),
  });

  return tx;
}

async function main() {
  const taskName = "distribute-erc20";
  const network = hre.network.name;

  const [signer] = await hre.ethers.getSigners();
  const provider = hre.ethers.provider;

  const tokenAddress = process.env.tokenAddress;
  const csvFile = process.env.csvFile;
  const decimalPlaces = Number(process.env.decimalPlaces || "0");

  if (!tokenAddress) {
    throw new Error("tokenAddress not specified");
  }
  if (!csvFile) {
    throw new Error("csvFile not specified");
  }

  // readFromCSV
  const { csvData } = await readFromCSV(csvFile);
  const cleanData = csvData.map((r) => r.map((i) => i.trim()));
  const qualifiedRecords = cleanData.filter((row) => {
    const q = row.length > 1 && ethers.isAddress(row[0].trim()) && Number(row[1]) > 0;  // amount > 0
    if (!q) {
      console.info(colorize(Color.yellow, `Unqualified row: ${row}`));
    }
    return q;
  });
  console.info("--------------------------------");

  let totalAmt = 0;
  for (const r of qualifiedRecords) {
    const v = Number(r[1]) * 10 ** decimalPlaces;
    if (Math.floor(v) != v) {
      throw new Error("Decimal places exceed: " + r[1]);
    }
    totalAmt = totalAmt + v;
  }
  totalAmt = totalAmt / 10 ** decimalPlaces;

  const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  
  console.info("reading token info...");
  const [name, symbol, decimals] = await Promise.all([erc20.name(), erc20.symbol(), erc20.decimals()]);

  console.info("reading balance info...");
  const [balance, ethBalance] = await Promise.all([
    erc20.balanceOf(DISTRIBUTER[network]),
    provider.getBalance(signer.address),
  ]);

  console.info("--------------------------------");
  console.info(colorize(Color.blue, `Distribute ERC20`));
  console.info(
    colorize(
      Color.yellow,
      `Network: ${network}, Signer: ${signer.address}, Gas Balance: ${ethers.formatEther(ethBalance)}`
    )
  );
  console.info(colorize(Color.yellow, `Token: ${name} ${symbol}, Decimals: ${decimals}`));
  console.info(colorize(Color.yellow, `Qualified Records: ${qualifiedRecords.length}`));
  console.info(colorize(Color.yellow, `Total Token Amount: ${totalAmt}`));
  console.info(colorize(Color.yellow, `Balance on Contract:  ${ethers.formatUnits(balance, decimals)}`));

  if (balance < ethers.parseUnits(totalAmt.toString(), decimals)) {
    throw new Error("Balance not enough");
  }
  if (decimalPlaces >= decimals) {
    throw new Error("decimalPlaces must be less then decimals");
  }

  if (!inputConfirm("Confirm? ")) {
    console.warn("Abort");
    return;
  }

  const BATCH_SIZE = 100;

  for (let i = 0; i < qualifiedRecords.length; i += BATCH_SIZE) {
    const recipients = qualifiedRecords.slice(i, i + BATCH_SIZE).map((item) => item[0]);
    const amounts = qualifiedRecords.slice(i, i + BATCH_SIZE).map((item) => Number(item[1]) * 10 ** decimalPlaces);

    const tx = await distributeERC20(tokenAddress, recipients, amounts, Number(decimals) - decimalPlaces);
    const endIdx = Math.min(i + BATCH_SIZE, qualifiedRecords.length);

    if (tx) {
      console.log("distributeERC20 Success with txHash: " + tx.hash);
      console.log(`[${i}, ${endIdx}) sent -----------------------`);
    } else {
      console.log("distributeERC20 Fail with txHash: " + tx.hash);
      console.log(`[${i}, ${endIdx}) failed !!!!!!`);
    }
    await logAndWaitTx(tx, taskName, network, `distributeERC20 to #[${i}, ${endIdx})`);
  }

  const balanceRemaining = await erc20.balanceOf(DISTRIBUTER[network]);
  console.info(
    colorize(Color.yellow, `Remaining Balance on Contract:  ${ethers.formatUnits(balanceRemaining, decimals)}`)
  );
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
