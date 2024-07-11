import { ethers } from "hardhat";
import { Signer, Contract } from "ethers";
import { UserOperation } from "./userOperation";
import { EntryPoint } from "../../../typechain-types";

export async function makeUserOp(functionName: string, functionParams: any, userOpSender: string, userOpSigner: Signer, entryPoint: EntryPoint, ecdsaOwnershipRegistryModuleAddress: string, option?: {
    preVerificationGas?: number,
}, nonceKey = 0): Promise<UserOperation> {
    const smartAccount = await ethers.getContractFactory("SmartAccount")
    const callData = smartAccount.interface.encodeFunctionData(functionName, functionParams);
    const userOp = await fillAndSign(
        {
            sender: userOpSender,
            callData: callData,
            ...option,
        },
        userOpSigner,
        entryPoint,
        "nonce",
        true,
        nonceKey,
        0
    );
    const signatureWithEcdsaOwnershipRegistryModuleAddressData = ethers.AbiCoder.defaultAbiCoder().encode(["bytes", "address"], [userOp.signature, ecdsaOwnershipRegistryModuleAddress]);
    userOp.signature = signatureWithEcdsaOwnershipRegistryModuleAddressData;
    return userOp;
}

export async function fillAndSign(op: Partial<UserOperation>, signer: Signer, entryPoint: EntryPoint, getnonceFunction = "nonce", useNonceKey = true, nonceKey = 0, extraPreVerificationGas = 0): Promise<UserOperation> {
    const op2 = await fillUserOp(op, entryPoint, getnonceFunction, useNonceKey, nonceKey);
    op2.preVerificationGas = Number(op2.preVerificationGas) + extraPreVerificationGas;
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const message = ethers.getBytes(getUserOpHash(op2, await entryPoint.getAddress(), Number(chainId)));
    return {
        ...op2,
        signature: await signer.signMessage(message)
    };
}

function getUserOpHash(
    op: UserOperation,
    entryPoint: string,
    chainId: Number
): string {
    const userOpHash = ethers.keccak256(packUserOp(op, true));
    const enc = ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "address", "uint256"],
        [userOpHash, entryPoint, chainId]
    );
    return ethers.keccak256(enc);
}

function packUserOp(op: UserOperation, forSignature = true): string {
    if (forSignature) {
        return ethers.AbiCoder.defaultAbiCoder().encode(
            [
                "address",
                "uint256",
                "bytes32",
                "bytes32",
                "uint256",
                "uint256",
                "uint256",
                "uint256",
                "uint256",
                "bytes32",
            ],
            [
                op.sender,
                op.nonce,
                ethers.keccak256(op.initCode),
                ethers.keccak256(op.callData),
                op.callGasLimit,
                op.verificationGasLimit,
                op.preVerificationGas,
                op.maxFeePerGas,
                op.maxPriorityFeePerGas,
                ethers.keccak256(op.paymasterAndData),
            ]
        );
    } else {
        // for the purpose of calculating gas cost encode also signature (and no keccak of bytes)
        return ethers.AbiCoder.defaultAbiCoder().encode(
            [
                "address",
                "uint256",
                "bytes",
                "bytes",
                "uint256",
                "uint256",
                "uint256",
                "uint256",
                "uint256",
                "bytes",
                "bytes",
            ],
            [
                op.sender,
                op.nonce,
                op.initCode,
                op.callData,
                op.callGasLimit,
                op.verificationGasLimit,
                op.preVerificationGas,
                op.maxFeePerGas,
                op.maxPriorityFeePerGas,
                op.paymasterAndData,
                op.signature,
            ]
        );
    }
}

async function fillUserOp(
    op: Partial<UserOperation>,
    entryPoint?: EntryPoint,
    getNonceFunction = "nonce",
    useNonceKey = true,
    nonceKey = 0
): Promise<UserOperation> {
    const op1 = { ...op };
    const provider = ethers.provider;
    if (op1.nonce == null) {
        if (provider == null)
            throw new Error("must have entryPoint to autofill nonce");
        // Review/TODO: if someone passes 'nonce' as nonceFunction. or change the default

        if (useNonceKey) {
            const c = new Contract(
                op.sender!,
                [`function nonce(uint192) view returns(uint256)`],
                provider
            );
            op1.nonce = await c.nonce(nonceKey).catch();
        } else {
            const c = new Contract(
                op.sender!,
                [`function ${getNonceFunction}() view returns(uint256)`],
                provider
            );
            op1.nonce = await c[getNonceFunction]().catch();
        }
    }
    if (op1.callGasLimit == null && op.callData != null) {
        op1.callGasLimit = 3_000_000;
    }
    if (op1.maxFeePerGas == null) {
        const baseFeePerGas = await provider.getBlock("latest");
        op1.maxFeePerGas = Number(baseFeePerGas?.baseFeePerGas) + Number(DefaultsForUserOp.maxPriorityFeePerGas)
            ;
    }
    // TODO: this is exactly what fillUserOp below should do - but it doesn't.
    // adding this manually
    if (op1.maxPriorityFeePerGas == null) {
        op1.maxPriorityFeePerGas = DefaultsForUserOp.maxPriorityFeePerGas;
    }
    const op2 = fillUserOpDefaults(op1);
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    if (op2.preVerificationGas.toString() === "0") {
        // TODO: we don't add overhead, which is ~21000 for a single TX, but much lower in a batch.
        // op2.preVerificationGas = callDataCost(packUserOp(op2, false));
    }
    return op2;
}

function fillUserOpDefaults(
    op: Partial<UserOperation>,
    defaults = DefaultsForUserOp
): UserOperation {
    const partial: any = { ...op };
    // we want "item:undefined" to be used from defaults, and not override defaults, so we must explicitly
    // remove those so "merge" will succeed.
    for (const key in partial) {
        if (partial[key] == null) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete partial[key];
        }
    }
    const filled = { ...defaults, ...partial };
    return filled;
}

const DefaultsForUserOp: UserOperation = {
    sender: ethers.ZeroAddress,
    nonce: 0,
    initCode: "0x",
    callData: "0x",
    callGasLimit: 0,
    verificationGasLimit: 250000, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
    preVerificationGas: 21000, // should also cover calldata cost.
    maxFeePerGas: 0,
    maxPriorityFeePerGas: 1e9,
    paymasterAndData: "0x",
    signature: "0x",
};