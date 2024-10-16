import { ethers } from 'ethers';
import Distribute_ABI from '../abi/Distribute.json';
import ERC20_ABI from '../abi/ERC20.json';
import { readFromCSV } from '../utils/csv-to-string';
import { DISTRIBUTER } from '../constants/address';
import { providerByNetwork } from '../lib/provider';
import * as NETWORK from '../constants/network';
import { logAndWaitTx } from '../utils/logger';

async function distributeERC20(
  network: string,
  provider: ethers.Provider,
  signer: ethers.Signer,
  tokenAddress: string, recipients: string[], amounts: string[],
  decimals?: number, sender?: string
) {
  const rtAddr = DISTRIBUTER[network];
  const distributer = new ethers.Contract(rtAddr, Distribute_ABI, signer);

  let gas, feeData, tx;

  [gas, feeData] = await Promise.all([
    distributer.distributeTokens.estimateGas(tokenAddress, recipients, amounts, decimals ?? 0, sender ?? ethers.ZeroAddress),
    provider.getFeeData()
  ]);

  tx = await distributer.distributeTokens(tokenAddress, recipients, amounts, decimals ?? 0, sender ?? ethers.ZeroAddress, {
    gasPrice: BigInt(feeData.gasPrice ?? 0) * BigInt(20) / BigInt(10),
    gasLimit: BigInt(gas) * BigInt(12) / BigInt(10)
  });

  return tx;
}

async function main() {
  const taskName = 'distribute-erc20'
  const network = NETWORK.SEPOLIA;
  const provider = providerByNetwork(network)
  const params = {
    tokenAddress: '0x12065F0d03cd1Bd280565069164F9E803c2DA988', // test coin
    from: process.env.DISTRIBUTER_PARIVATE_KEY ?? '',
    distributer_filepath: './airdrop/csv/distribute-erc20.csv'
  };

  const signer: ethers.Wallet = new ethers.Wallet(params.from, provider);
  const eth_balance = await provider.getBalance(signer.address);
  console.log(`[${signer.address}]: Sender native token balance ${ethers.formatEther(eth_balance)}`);

  const erc20_addr = params.tokenAddress;
  const erc20 = new ethers.Contract(erc20_addr, ERC20_ABI, signer);
  const erc20_balance = await erc20.balanceOf(DISTRIBUTER[network])
  const erc20_decimal = await erc20.decimals()
  console.log(`[${erc20_addr}]: Distributer Contract erc20 balance ${ethers.formatUnits(erc20_balance, erc20_decimal)}`);

  const BATCH_SIZE = 100;

  // readFromCSV
  const { csvData } = await readFromCSV(params.distributer_filepath);
  const qualifiedAddress = csvData.filter((row) => Number(row[1]) > 0);  // amount > 0

  for (let i = 0; i < qualifiedAddress.length; i += BATCH_SIZE) {
    const recipients = qualifiedAddress.slice(i, i + BATCH_SIZE).map((item) => item[0]);
    const amounts = qualifiedAddress.slice(i, i + BATCH_SIZE).map((item) => item[1]);

    const tx = await distributeERC20(network, provider, signer, erc20_addr, recipients, amounts);
    const endIdx = Math.min(i + BATCH_SIZE, qualifiedAddress.length);

    if (tx) {
      console.log('distributeERC20 Success with txHash:' + tx.hash);
      console.log(`[${i}, ${endIdx}) sent -----------------------`);
    } else {
      console.log('distributeERC20 Fail with txHash:' + tx.hash);
      console.log(`[${i}, ${endIdx}) failed !!!!!!`);
    }
    await logAndWaitTx(tx, taskName, `distributeERC20 to #[${i}, ${endIdx})`);
  }
}

main().catch(console.error);