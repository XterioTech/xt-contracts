import { AddressLike, BigNumberish, Signer } from "ethers";
import { getEcdsaOwnershipRegistryModule, getEntryPoint, getSmartAccountFactory, getSmartAccountImplementation } from "./setupHelper";
import { ethers } from "hardhat";
import { EcdsaOwnershipRegistryModule, EntryPoint, SmartAccount } from "../../../typechain-types";
import { makeUserOp } from "./userOp";

// 
export async function getSmartAccountComponents() {
    const entryPoint = await getEntryPoint();
    const ecdsaOwnershipRegistryModule = await getEcdsaOwnershipRegistryModule();
    return { entryPoint, ecdsaOwnershipRegistryModule };
}

// 通过 eoa 地址获取 aa 钱包
export async function getSmartAccountByOwner(entryPoint: EntryPoint, ecdsaOwnershipRegistryModule: EcdsaOwnershipRegistryModule, smartAccountEoaOwner: Signer) {
    const smartAccountImplementation = await getSmartAccountImplementation(entryPoint.target);

    const smartAccountFactory = await getSmartAccountFactory(smartAccountImplementation.target, await smartAccountEoaOwner.getAddress());

    const initForSmartAccountData = ecdsaOwnershipRegistryModule.interface.encodeFunctionData("initForSmartAccount", [await smartAccountEoaOwner.getAddress()]);
    const index = 0;
    const expectedSmartAccountAddress = await smartAccountFactory.getAddressForCounterFactualAccount(ecdsaOwnershipRegistryModule.target, initForSmartAccountData, index);
    await smartAccountFactory.deployCounterFactualAccount(ecdsaOwnershipRegistryModule.target, initForSmartAccountData, index);
    const smartAccount = await ethers.getContractAt("SmartAccount", expectedSmartAccountAddress);

    await smartAccountEoaOwner.sendTransaction({
        to: smartAccount.target,
        value: ethers.parseEther("100"),
    });

    return smartAccount;
}

// 执行 aa 钱包的 execute 方法
export async function callSmartAccountExecuteMethod(entryPoint: EntryPoint, ecdsaOwnershipRegistryModule: EcdsaOwnershipRegistryModule, smartAccount: SmartAccount, smartAccountEoaOwner: Signer, dest: AddressLike, value: BigNumberish, func: string) {
    const userOp = await makeUserOp("execute", [dest, value, func], await smartAccount.getAddress(), smartAccountEoaOwner, entryPoint, await ecdsaOwnershipRegistryModule.getAddress());
    await entryPoint.handleOps([userOp], await smartAccountEoaOwner.getAddress());
}