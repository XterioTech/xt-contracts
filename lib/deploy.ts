import hre from "hardhat";
import { TokenGateway } from "../typechain-types";

export const deployGateway = async (gatewayAdmin: unknown) => {
  const Gateway = await hre.ethers.getContractFactory("TokenGateway");
  const gateway = (await hre.upgrades.deployProxy(Gateway, [gatewayAdmin])) as unknown as TokenGateway;
  await gateway.waitForDeployment();
  return gateway;
};

export const deployForwarder = async () => {
  //   const Forwarder = await hre.ethers.getContractFactory("Forwarder");
  //   const forwarder = await Forwarder.deploy();
  //   await forwarder.waitForDeployment();
  //   return forwarder;
  const forwarder = await hre.ethers.deployContract("Forwarder");
  await forwarder.waitForDeployment();
  return forwarder;
};
