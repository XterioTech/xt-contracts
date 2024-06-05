import { ethers, Interface } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

export enum Color {
  reset = "\x1b[0m",
  bright = "\x1b[1m",
  red = "\x1b[31m",
  green = "\x1b[32m",
  yellow = "\x1b[33m",
  blue = "\x1b[34m",
  magenta = "\x1b[35m",
  cyan = "\x1b[36m",
  white = "\x1b[37m",
}

export function colorize(color: Color, text: string) {
  return color + text + Color.reset;
}

export const getInterfaceID = (contractInterface: Interface) => {
  let interfaceID = ethers.getBigInt(0);
  contractInterface.forEachFunction((f) => {
    interfaceID = interfaceID ^ ethers.getBigInt(f.selector);
  });
  return ethers.toBeHex(interfaceID);
};
export const IERC721InterfaceID = "0x80ac58cd";
export const IERC1155InterfaceID = "0xd9b67a26";
export const IERC2981InterfaceID = "0x2a55205a";


export const infoAboutDeployer = async (hre: HardhatRuntimeEnvironment, deployer: HardhatEthersSigner) => {
  const nonce = await hre.ethers.provider.getTransactionCount(deployer.address, "pending")
  console.info(colorize(Color.yellow, `Network: ${hre.network.name}, Deployer: ${deployer.address}, Nonce: ${nonce}`));  
}
