import { ethers } from "hardhat";
import { BytesLike, Signer } from "ethers";
import MerkleTree from "merkletreejs";
import { UserOperation } from "./userOperation";
import { EntryPoint } from "../../../typechain-types";
import { fillAndSign, makeUserOp } from "./userOp";

export async function makeEcdsaSessionKeySignedUserOp(
    functionName: string,
    functionParams: any,
    userOpSender: string,
    sessionKey: Signer,
    entryPoint: EntryPoint,
    sessionKeyManagerAddress: string,
    validUntil: number,
    validAfter: number,
    sessionValidationModuleAddress: string,
    sessionKeyParamsData: BytesLike,
    merkleProof: any,
    options?: {
        preVerificationGas?: number;
    }
): Promise<UserOperation> {
    const SmartAccount = await ethers.getContractFactory("SmartAccount");

    const txnDataAA1 = SmartAccount.interface.encodeFunctionData(
        functionName,
        functionParams
    );

    const userOp = await fillAndSign(
        {
            sender: userOpSender,
            callData: txnDataAA1,
            ...options,
        },
        sessionKey,
        entryPoint,
        "nonce",
        true
    );

    const paddedSig = ethers.AbiCoder.defaultAbiCoder().encode(
        // validUntil, validAfter, sessionVerificationModule address, validationData, merkleProof, signature
        ["uint48", "uint48", "address", "bytes", "bytes32[]", "bytes"],
        [
            validUntil,
            validAfter,
            sessionValidationModuleAddress,
            sessionKeyParamsData,
            merkleProof,
            userOp.signature,
        ]
    );

    const signatureWithModuleAddress = ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes", "address"],
        [paddedSig, sessionKeyManagerAddress]
    );
    userOp.signature = signatureWithModuleAddress;

    return userOp;
}

export async function enableNewTreeForSmartAccountViaEcdsa(
    leaves: BytesLike[],
    sessionKeyManagerAddress: string,
    SmartAccountAddress: string,
    smartAccountOwner: Signer,
    entryPoint: EntryPoint,
    ecdsaModuleAddress: string
): Promise<MerkleTree> {
    const merkleTree = new MerkleTree(leaves, ethers.keccak256, {
        sortPairs: true,
        hashLeaves: false,
    });
    const sessionKeyManager = await ethers.getContractFactory("SessionKeyManager")
    const addMerkleRootUserOp = await makeUserOp(
        "execute_ncC",
        [
            sessionKeyManagerAddress,
            ethers.parseEther("0"),
            sessionKeyManager.interface.encodeFunctionData("setMerkleRoot", [
                merkleTree.getHexRoot(),
            ]),
        ],
        SmartAccountAddress,
        smartAccountOwner,
        entryPoint,
        ecdsaModuleAddress
    );
    const tx = await entryPoint.handleOps(
        [addMerkleRootUserOp],
        await smartAccountOwner.getAddress()
    );
    await tx.wait();
    return merkleTree;
}