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
  console.log(hre.network.config.chainId)
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
