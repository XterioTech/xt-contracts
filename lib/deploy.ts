import hre, { ethers } from "hardhat";
import { MarketplaceV2, TokenGateway } from "../typechain-types";
import { AddressLike, Overrides, BigNumberish } from "ethers";
import { NonPayableOverrides } from "../typechain-types/common";
import MerkleTree from "merkletreejs";
import keccak256 from "keccak256";

export const deployMajorToken = async (
  admin: AddressLike,
  wallet: AddressLike,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Token = await hre.ethers.getContractFactory("XterToken");
  const token = await Token.deploy(admin, wallet, txOverrides || {});
  await token.waitForDeployment();
  return token;
};

export const deployGateway = async (gatewayAdmin: AddressLike, txOverrides?: Overrides) => {
  const Contract = await hre.ethers.getContractFactory("TokenGateway");
  const contract = (await hre.upgrades.deployProxy(
    Contract,
    [gatewayAdmin],
    txOverrides ? { txOverrides } : undefined
  )) as unknown as TokenGateway;
  await contract.waitForDeployment();
  return contract;
};

export const deployMarketplaceV2 = async (
  gateway: AddressLike, // Marketplace will query the manager address of a token in `atomicMatchAndDeposit`
  serviceFeeRecipient: AddressLike,
  paymentToken?: AddressLike,
  txOverrides?: Overrides
) => {
  const resolvedParams = await Promise.all([gateway, serviceFeeRecipient].map((v) => hre.ethers.resolveAddress(v)));
  const Contract = await hre.ethers.getContractFactory("MarketplaceV2");
  const contract = (await hre.upgrades.deployProxy(
    Contract,
    resolvedParams,
    txOverrides ? { txOverrides } : undefined
  )) as unknown as MarketplaceV2;
  await contract.waitForDeployment();

  // Initialize the marketplace contract.
  if (paymentToken) {
    await contract.addPaymentTokens([paymentToken]);
  }

  return contract;
};

export const deployForwarder = async (txOverrides?: NonPayableOverrides & { from?: string }) => {
  const Contract = await hre.ethers.getContractFactory("Forwarder");
  const contract = await Contract.deploy(txOverrides || {});
  await contract.waitForDeployment();
  return contract;
};

export const deployWhitelistMinter = async (
  gateway: AddressLike,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await hre.ethers.getContractFactory("WhitelistMinter");
  const contract = await Contract.deploy(gateway, txOverrides || {});
  await contract.waitForDeployment();
  return contract;
};

export const deployLootboxUnwrapper = async (gateway: AddressLike) => {
  const Contract = await hre.ethers.getContractFactory("LootboxUnwrapper");
  const contract = await Contract.deploy(gateway);
  await contract.waitForDeployment();
  return contract;
};

export const deployCreatorTokenTransferValidator = async (defaultOwner: AddressLike) => {
  const Contract = await hre.ethers.getContractFactory("CreatorTokenTransferValidator");
  const contract = await Contract.deploy(defaultOwner);
  await contract.waitForDeployment();
  return contract;
};

export const deployFansCreate = async (
  admin: AddressLike,
  signer: AddressLike,
  recipient: AddressLike,
  uri: string,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await hre.ethers.getContractFactory("FansCreate");
  const contract = await Contract.deploy(admin, signer, recipient, uri, txOverrides || {});
  await contract.waitForDeployment();
  return contract;
};

export const deployFansCreateERC20 = async (
  admin: AddressLike,
  signer: AddressLike,
  recipient: AddressLike,
  uri: string,
  paymentToken: AddressLike,
  priceCoef: BigNumberish,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await hre.ethers.getContractFactory("FansCreateERC20");
  const contract = await Contract.deploy(admin, signer, recipient, uri, paymentToken, priceCoef, txOverrides || {});
  await contract.waitForDeployment();
  return contract;
};

export const deployAuctionMinter = async (
  admin: AddressLike,
  gateway: AddressLike,
  nftAddress: AddressLike,
  paymentRecipient: AddressLike,
  nftAmount: number, // heap maxCapacity
  auctionEndTime: number,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await hre.ethers.getContractFactory("AuctionMinter");
  const contract = await Contract.deploy(
    admin,
    gateway,
    nftAddress,
    paymentRecipient,
    nftAmount,
    auctionEndTime,
    txOverrides || {}
  );
  await contract.waitForDeployment();
  return contract;
};

export const deployRaffleAuctionMinter = async (
  admin: AddressLike,
  gateway: AddressLike,
  nftAddress: AddressLike,
  paymentRecipient: AddressLike,
  nftAmount: number, // heap maxCapacity
  auctionEndTime: number,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await hre.ethers.getContractFactory("RaffleAuctionMinter");
  const contract = await Contract.deploy(
    admin,
    gateway,
    nftAddress,
    paymentRecipient,
    nftAmount,
    auctionEndTime,
    txOverrides || {}
  );
  await contract.waitForDeployment();
  return contract;
};

export const deployDepositMinter = async (
  admin: AddressLike,
  gateway: AddressLike,
  nftAddress: AddressLike,
  paymentRecipient: AddressLike,
  auctionStartTime: number,
  auctionEndTime: number,
  unitPrice: BigNumberish,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await hre.ethers.getContractFactory("DepositMinter");
  const contract = await Contract.deploy(
    admin,
    gateway,
    nftAddress,
    paymentRecipient,
    auctionStartTime,
    auctionEndTime,
    unitPrice,
    txOverrides || {}
  );
  await contract.waitForDeployment();
  return contract;
};

export const deployDepositRaffleMinter = async (
  admin: AddressLike,
  gateway: AddressLike,
  nftAddress: AddressLike,
  paymentRecipient: AddressLike,
  auctionStartTime: number,
  auctionEndTime: number,
  unitPrice: BigNumberish,
  maxShare: BigNumberish,
  nftPrice: BigNumberish,
  nftAmount: BigNumberish,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await hre.ethers.getContractFactory("DepositRaffleMinter");
  const contract = await Contract.deploy(
    admin,
    gateway,
    nftAddress,
    paymentRecipient,
    auctionStartTime,
    auctionEndTime,
    unitPrice,
    maxShare,
    nftPrice,
    nftAmount,
    txOverrides || {}
  );
  await contract.waitForDeployment();
  return contract;
};

export const deployPalioIncubator = async (
  gateway: AddressLike,
  payeeAddress: AddressLike,
  eggAddress: AddressLike,
  chatNFTAddress: AddressLike,
  eventStartTime: number,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await hre.ethers.getContractFactory("PalioIncubator");
  const contract = await Contract.deploy(
    gateway,
    payeeAddress,
    eggAddress,
    chatNFTAddress,
    eventStartTime,
    txOverrides || {}
  );
  await contract.waitForDeployment();
  return contract;
};

export const deployPalioVoter = async (
  signer: AddressLike,
  eventStartTime: number,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await hre.ethers.getContractFactory("PalioVoter");
  const contract = await Contract.deploy(signer, eventStartTime, txOverrides || {});
  await contract.waitForDeployment();
  return contract;
};

export const deployWhitelistClaimETH = async (
  merkleRoot: string,
  startTime: number,
  deadline: number,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const WhitelistClaimETH = await ethers.getContractFactory("WhitelistClaimETH");
  const whitelistClaimETH = await WhitelistClaimETH.deploy(
    merkleRoot,
    startTime,
    deadline,
    txOverrides || {}
  );
  await whitelistClaimETH.waitForDeployment();
  return whitelistClaimETH;
};

export const deployWhitelistClaimERC20 = async (
  merkleRoot: string,
  startTime: number,
  deadline: number,
  paymentToken: AddressLike,
  vault: AddressLike,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const WhitelistClaimERC20 = await ethers.getContractFactory("WhitelistClaimERC20");
  const whitelistClaimERC20 = await WhitelistClaimERC20.deploy(
    merkleRoot,
    startTime,
    deadline,
    paymentToken,
    vault,
    txOverrides || {}
  );
  await whitelistClaimERC20.waitForDeployment();
  return whitelistClaimERC20;
};

export const deployTokenDistribute = async (
  defaultOwner: AddressLike,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await hre.ethers.getContractFactory("TokenDistribute");
  const contract = await Contract.deploy(defaultOwner, txOverrides || {})
  await contract.waitForDeployment();
  return contract;
};

export const deployAggregator = async (
  defaultOwner: AddressLike,
  decimals: number,
  description: string,
  version: number,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await hre.ethers.getContractFactory("Aggregator");
  const contract = await Contract.deploy(defaultOwner, decimals, description, version, txOverrides || {})
  await contract.waitForDeployment();
  return contract;
};


export const deployOnchainIAP = async (
  admin: string,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await ethers.getContractFactory("OnchainIAP");
  const contract = await Contract.deploy(admin, txOverrides || {});
  await contract.waitForDeployment();
  return contract;
};