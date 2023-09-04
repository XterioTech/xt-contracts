import hre from "hardhat";
import { TokenGateway } from "../typechain-types";
import { AddressLike } from "ethers";

export const deployMajorToken = async (wallet: AddressLike) => {
  const Token = await hre.ethers.getContractFactory("XterToken");
  const token = await Token.deploy(wallet);
  await token.waitForDeployment();
  return token;
};

export const deployGateway = async (gatewayAdmin: unknown) => {
  const Gateway = await hre.ethers.getContractFactory("TokenGateway");
  const gateway = (await hre.upgrades.deployProxy(Gateway, [gatewayAdmin])) as unknown as TokenGateway;
  await gateway.waitForDeployment();
  return gateway;
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
