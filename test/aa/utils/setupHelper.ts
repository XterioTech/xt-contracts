
import { ethers } from "hardhat";
import { AddressLike } from "ethers";

export async function getEntryPoint() {
    const getContractFactory = ethers.getContractFactory("EntryPoint");
    const entryPoint = (await getContractFactory).deploy();
    return entryPoint;
}

export async function getEcdsaOwnershipRegistryModule() {
    const getContractFactory = ethers.getContractFactory("EcdsaOwnershipRegistryModule");
    const ecdsaOwnershipRegistryModule = (await getContractFactory).deploy();
    return ecdsaOwnershipRegistryModule;
}

export async function getSmartAccountFactory(_basicImplementation: AddressLike, _newOwner: AddressLike) {
    const getContractFactory = ethers.getContractFactory("SmartAccountFactory");
    const smartAccountFactory = (await getContractFactory).deploy(_basicImplementation, _newOwner);
    return smartAccountFactory;
}

export async function getSmartAccountImplementation(entryPoint: AddressLike) {
    const getContractFactory = ethers.getContractFactory("SmartAccount");
    const smartAccount = (await getContractFactory).deploy(entryPoint);
    return smartAccount;
}

export async function getSessionKeyManager() {
    const getContractFactory = ethers.getContractFactory("SessionKeyManager");
    const sessionKeyManager = (await getContractFactory).deploy();
    return sessionKeyManager;
}