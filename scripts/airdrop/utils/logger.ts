import { ethers } from 'ethers';
import fs from 'fs';

const getTimestamp = () => new Date().toISOString();

interface LogObj {
  network: string;
  address: string; 
  eventName: string; 
  txHash: string; 
  timestamp: string;
  errMessage?: any;
}

export const logAndWaitTx = async (tx: ethers.TransactionResponse, taskName: string, network: string, eventName: string) => {
  const logFilePath = `./${new Date().toJSON().slice(0, 10)}_${taskName}.log`;

  const simpleLogger = {
    txInfo: (info: LogObj) => {
      const logMessage = JSON.stringify({level: "info", ...info}) + "\n"
      fs.appendFileSync(logFilePath, logMessage);
    },
    txError: (error: LogObj) => {
      const logMessage = JSON.stringify({level: "error", ...error}) + "\n"
      fs.appendFileSync(logFilePath, logMessage);
    }
  };

  simpleLogger.txInfo({
    network,
    address: `${tx.from}`,
    eventName: eventName,
    txHash: tx.hash,
    timestamp: getTimestamp()
  });

  const timeout = 120000; // 设置超时时间为120秒（2分钟）
  const txPromise = tx.wait();

  try {
    return await Promise.race([
      txPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction timed out')), timeout))
    ]);
  } catch (e) {
    simpleLogger.txError({
      network,
      address: `${tx.from}`,
      eventName: eventName,
      txHash: tx.hash,
      errMessage: e,
      timestamp: getTimestamp()
    });
  }
};