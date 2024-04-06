
import hre from "hardhat";
import { MarketplaceV2, TokenGateway } from "../typechain-types";
import { AddressLike, Overrides } from "ethers";
import { NonPayableOverrides } from "../typechain-types/common";

export const deployScoreNFT = async (
  name: string,
  symbol: string,
  baseURI: string,
  admin: AddressLike,
  signer_address: AddressLike,
  mechPal_address: AddressLike,
  rare_ticket_address: AddressLike
) => {
  const ScoreNFT = await hre.ethers.getContractFactory("ScoreNFT", {});

  const scoreNFT = await ScoreNFT.deploy(
    name,
    symbol,
    baseURI,
    admin,
    signer_address,
    mechPal_address,
    rare_ticket_address, {
    gasPrice: 2500000008
  }
  );
  await scoreNFT.waitForDeployment();

  return { scoreNFT };
};


export const deployPrizeClaimer = async (
  admin: AddressLike,
  gateway: AddressLike,
  singer_address: AddressLike,
  payeeAddress: AddressLike,
  hammerNFTAddress: AddressLike,
  dogtagNFTAddress: AddressLike,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await hre.ethers.getContractFactory("PrizeClaimer");
  const contract = await Contract.deploy(
    admin,
    gateway,
    singer_address,
    payeeAddress,
    hammerNFTAddress,
    dogtagNFTAddress,
    txOverrides || {}
  );
  await contract.waitForDeployment();
  return contract;
};

export const deployInvitationFund = async (
  gateway: AddressLike,
  scoreNFTAddress: AddressLike,
  mintableTokenAddr: AddressLike,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await hre.ethers.getContractFactory("InvitationFund");
  const contract = await Contract.deploy(
    gateway,
    scoreNFTAddress,
    mintableTokenAddr,
    txOverrides || {}
  );
  await contract.waitForDeployment();
  return contract;
};

// ************ test contracts ************ //
export const deployExternalERC721 = async (name: string, symbol: string, baseURI: string, _admin: string) => {
  const E721 = await hre.ethers.getContractFactory("ExternalERC721");
  const e721 = await E721.deploy(name, symbol, baseURI, _admin);
  await e721.waitForDeployment();
  return { e721 };
};

export const deployExternalERC1155 = async (baseURI: string) => {
  const E1155 = await hre.ethers.getContractFactory("ExternalERC1155");
  const e1155 = await E1155.deploy(baseURI);
  await e1155.waitForDeployment();
  return { e1155 };
};

export const deployRareTicket = async (baseURI: string) => {
  const RareTicket = await hre.ethers.getContractFactory("RareTicket");
  const rareTicket = await RareTicket.deploy(baseURI);
  await rareTicket.waitForDeployment();
  return { rareTicket };
};