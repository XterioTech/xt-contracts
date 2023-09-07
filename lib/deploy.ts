import hre from "hardhat";
import { MarketplaceV2, TokenGateway } from "../typechain-types";
import { AddressLike } from "ethers";

export const deployMajorToken = async (wallet: AddressLike) => {
  const Token = await hre.ethers.getContractFactory("XterToken");
  const token = await Token.deploy(wallet);
  await token.waitForDeployment();
  return token;
};

export const deployGateway = async (gatewayAdmin: AddressLike) => {
  const Contract = await hre.ethers.getContractFactory("TokenGateway");
  const contract = (await hre.upgrades.deployProxy(Contract, [gatewayAdmin])) as unknown as TokenGateway;
  await contract.waitForDeployment();
  return contract;
};

export const deployMarketplaceV2 = async (
  gateway: AddressLike,
  paymentToken: AddressLike,
  serviceFeeRecipient: AddressLike
) => {
  const Contract = await hre.ethers.getContractFactory("MarketplaceV2");
  const contract = (await hre.upgrades.deployProxy(Contract)) as unknown as MarketplaceV2;
  await contract.waitForDeployment();

  // Initialize the marketplace contract.
  await contract.addPaymentTokens([paymentToken]);
  await contract.setServiceFeeRecipient(serviceFeeRecipient);
  // Marketplace will in `atomicMatchAndDeposit` query the manager address of a token.
  await contract.setGateway(gateway);

  return contract;
};

export const deployForwarder = async () => {
  const Contract = await hre.ethers.getContractFactory("Forwarder");
  const contract = await Contract.deploy();
  await contract.waitForDeployment();
  return contract;
};

export const deployWhitelistMinter = async (gateway: AddressLike) => {
  const Contract = await hre.ethers.getContractFactory("WhitelistMinter");
  const contract = await Contract.deploy(gateway);
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
