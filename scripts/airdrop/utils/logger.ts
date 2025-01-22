import { ethers } from 'ethers';
import fs from 'fs';

const getTimestamp = () => new Date().toISOString();

const formatLogMessage = (info: any) => {
  return Object.entries(info)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
};

export const logAndWaitTx = async (tx: ethers.TransactionResponse, taskName: string, eventName: string) => {
  const logFilePath = `./${new Date().toJSON().slice(0, 10)}_${taskName}.log`;

  const simpleLogger = {
    txInfo: (info: { address: string; eventName: string; txHash: string; timestamp: string }) => {
      const logMessage = `Transaction Info [${info.timestamp}]:\n{\n${formatLogMessage(info)}\n}\n`;
      fs.appendFileSync(logFilePath, logMessage);
      // console.log(logMessage);
    },
    txError: (error: { address: string; eventName: string; txHash: string; errMessage: any; timestamp: string }) => {
      const logMessage = `Transaction Error [${error.timestamp}]:\n{\n${formatLogMessage(error)}\n}\n`;
      fs.appendFileSync(logFilePath, logMessage);
      // console.error(logMessage);
    }
  };

  simpleLogger.txInfo({
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
      address: `${tx.from}`,
      eventName: eventName,
      txHash: tx.hash,
      errMessage: e,
      timestamp: getTimestamp()
    });
  }
};