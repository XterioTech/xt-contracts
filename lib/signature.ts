import { Signer } from "ethers";
import hre from "hardhat";
import { AddressLike, BigNumberish } from "ethers";

export const signPublishFansCreate = async (
  signer: Signer,
  creator: AddressLike,
  workId: BigNumberish,
  projectId: BigNumberish,
  deadline: BigNumberish,
  contractAddress: AddressLike
) => {
  const msgHash = hre.ethers.solidityPackedKeccak256(
    [
      "address", // creator
      "uint256", // workId
      "uint256", // projectId
      "uint256", // deadline
      "uint256", // chainid
      "address", // contract address
    ],
    [creator, workId, projectId, deadline, hre.network.config.chainId, contractAddress]
  );
  return await signer.signMessage(hre.ethers.getBytes(msgHash));
};

export const signAuctionMinterBid = async (
  signer: Signer,
  bidder: string,
  bidPrice: BigNumberish,
  limitForBuyerID: BigNumberish,
  limitForBuyerAmount: BigNumberish,
  expireTime: BigNumberish,
  contractAddress: AddressLike
) => {
  const msgHash = hre.ethers.solidityPackedKeccak256(
    [
      "address", // bidder
      "uint256", // bidPrice
      "uint256", // limitForBuyerID
      "uint256", // limitForBuyerAmount
      "uint256", // expireTime
      "uint256", // chainid
      "address", // contract address
    ],
    [bidder, bidPrice, limitForBuyerID, limitForBuyerAmount, expireTime, hre.network.config.chainId, contractAddress]
  );
  return await signer.signMessage(hre.ethers.getBytes(msgHash));
};

export const signPalioVoter = async (
  signer: Signer,
  voter: string,
  characterIdx: number,
  amount: number,
  totalAmount: number,
  expireTime: number,
  contractAddress: AddressLike
) => {
  const msgHash = hre.ethers.solidityPackedKeccak256(
    [
      "address", // voter address
      "uint256", // characterIdx
      "uint256", // amount
      "uint256", // totalAmount
      "uint256", // expireTime
      "uint256", // chainid
      "address", // contract address
    ],
    [voter, characterIdx, amount, totalAmount, expireTime, hre.network.config.chainId, contractAddress]
  );
  return await signer.signMessage(hre.ethers.getBytes(msgHash));
};
