import hre from "hardhat";
import { MarketplaceV2, TokenGateway } from "../typechain-types";
import { AddressLike, Overrides, BigNumberish } from "ethers";
import { NonPayableOverrides } from "../typechain-types/common";

export const deployMajorToken = async (wallet: AddressLike) => {
  const Token = await hre.ethers.getContractFactory("XterToken");
  const token = await Token.deploy(wallet);
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

export const deployFansCreate = async (admin: AddressLike, uri: string, txOverrides?: NonPayableOverrides & { from?: string }) => {
  const Contract = await hre.ethers.getContractFactory("FansCreate");
  const contract = await Contract.deploy(admin, uri, txOverrides || {});
  await contract.waitForDeployment();
  return contract;
};

export const deployFansCreateERC20 = async (admin: AddressLike, uri: string, paymentToken: AddressLike, priceCoef: BigNumberish, txOverrides?: NonPayableOverrides & { from?: string }) => {
  const Contract = await hre.ethers.getContractFactory("FansCreateERC20");
  const contract = await Contract.deploy(admin, uri, paymentToken, priceCoef, txOverrides || {});
  await contract.waitForDeployment();
  return contract;
};

export const deployAuctionMinter = async (
  gateway: AddressLike,
  nftAddress: AddressLike,
  paymentRecipient: AddressLike,
  nftAmount: number, // heap maxCapacity
  auctionEndTime: number,
  txOverrides?: NonPayableOverrides & { from?: string }
) => {
  const Contract = await hre.ethers.getContractFactory("AuctionMinter");
  const contract = await Contract.deploy(gateway, nftAddress, paymentRecipient, nftAmount, auctionEndTime, txOverrides || {});
  await contract.waitForDeployment();
  return contract;
};


