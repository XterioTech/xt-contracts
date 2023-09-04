import hre from "hardhat";
import { TokenGateway } from "../typechain-types";

export const deployGateway = async (gatewayAdmin: unknown) => {
  const Gateway = await hre.ethers.getContractFactory("TokenGateway");
  const gateway = (await hre.upgrades.deployProxy(Gateway, [gatewayAdmin])) as unknown as TokenGateway;
  await gateway.waitForDeployment();
  return gateway;
};

export const deployForwarder = async () => {
  const contract = await hre.ethers.deployContract("Forwarder");
  await contract.waitForDeployment();
  return contract;
};

export const deployWhitelistMinter = async () => {
  const contract = await hre.ethers.deployContract("WhitelistMinter");
  await contract.waitForDeployment();
  return contract;
};
