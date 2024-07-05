import { expect } from "chai";
// import {
//     makeEcdsaSessionKeySignedUserOp,
//     enableNewTreeForSmartAccountViaEcdsa,
// } from "./utils/sessionKey";
import { ethers } from "hardhat";
import { BytesLike, AddressLike, Signer, Contract } from "ethers";

// import { makeEcdsaModuleUserOp } from "./utils/userOp";
// import {
//     getEntryPoint,
//     getEcdsaOwnershipRegistryModule,
//     getSmartAccountWithModule,
// } from "./utils/setupHelper";
// import { hexZeroPad, hexConcat } from "ethers/lib/utils";
import { UserOperation } from "./utils/userOperation";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { EntryPoint, SmartAccount } from "../../typechain-types";

async function getEntryPoint() {
    const getContractFactory = ethers.getContractFactory("EntryPoint");
    const entryPoint = (await getContractFactory).deploy();
    return entryPoint;
}

async function getEcdsaOwnershipRegistryModule() {
    const getContractFactory = ethers.getContractFactory("EcdsaOwnershipRegistryModule");
    const ecdsaOwnershipRegistryModule = (await getContractFactory).deploy();
    return ecdsaOwnershipRegistryModule;
}

async function getSmartAccountFactory(_basicImplementation: AddressLike, _newOwner: AddressLike) {
    const getContractFactory = ethers.getContractFactory("SmartAccountFactory");
    const smartAccountFactory = (await getContractFactory).deploy(_basicImplementation, _newOwner);
    return smartAccountFactory;
}

async function getSmartAccountImplementation(entryPoint: AddressLike) {
    const getContractFactory = ethers.getContractFactory("SmartAccount");
    const smartAccount = (await getContractFactory).deploy(entryPoint);
    return smartAccount;
}

async function getSessionKeyManager() {
    const getContractFactory = ethers.getContractFactory("SessionKeyManager");
    const sessionKeyManager = (await getContractFactory).deploy();
    return sessionKeyManager;
}

describe("SessionKey: Contract Address Session Validation Module", function () {
    async function setUp() {
        const [
            deployer,
            smartAccountOwner,
            sessionKey,
        ] = await ethers.getSigners();
        // console.log("getSigners:", await deployer.getAddress(), await smartAccountOwner.getAddress(), await sessionKey.getAddress());

        const entryPoint = await getEntryPoint();
        console.log("entryPoint:", entryPoint.target);

        const ecdsaOwnershipRegistryModule = await getEcdsaOwnershipRegistryModule();
        console.log("ecdsaOwnershipRegistryModule:", ecdsaOwnershipRegistryModule.target);

        const smartAccountImplementation = await getSmartAccountImplementation(entryPoint.target);
        console.log("smartAccountImplementation:", smartAccountImplementation.target);

        const smartAccountFactory = await getSmartAccountFactory(smartAccountImplementation.target, await deployer.getAddress());
        console.log("smartAccountFactory:", smartAccountFactory.target);

        const initForSmartAccountData = ecdsaOwnershipRegistryModule.interface.encodeFunctionData("initForSmartAccount", [await smartAccountOwner.getAddress()]);
        const index = 0;
        const expectedSmartAccountAddress = await smartAccountFactory.getAddressForCounterFactualAccount(ecdsaOwnershipRegistryModule.target, initForSmartAccountData, index);
        console.log("expectedSmartAccountAddress:", expectedSmartAccountAddress);
        await smartAccountFactory.deployCounterFactualAccount(ecdsaOwnershipRegistryModule.target, initForSmartAccountData, index);
        const userSA = await ethers.getContractAt("SmartAccount", expectedSmartAccountAddress);
        console.log("userSA:", userSA.target);

        await deployer.sendTransaction({
            to: userSA.target,
            value: ethers.parseEther("100"),
        });


        const sessionKeyManager = await getSessionKeyManager();
        console.log("sessionKeyManager:", sessionKeyManager.target);

        const userOp = await makeUserOp("enableModule", [sessionKeyManager.target], await userSA.getAddress(), smartAccountOwner, entryPoint, await ecdsaOwnershipRegistryModule.getAddress());
        console.log("userOp=", userOp)
        await entryPoint.handleOps([userOp], await smartAccountOwner.getAddress());
    }

    async function makeUserOp(functionName: string, functionParams: any, userOpSender: string, userOpSigner: Signer, entryPoint: EntryPoint, ecdsaOwnershipRegistryModuleAddress: string, option?: {
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

    async function fillAndSign(op: Partial<UserOperation>, signer: Signer, entryPoint: EntryPoint, getnonceFunction = "nonce", useNonceKey = true, nonceKey = 0, extraPreVerificationGas = 0): Promise<UserOperation> {

        const op2 = await fillUserOp(op, getnonceFunction, useNonceKey, nonceKey);

        // op2.preVerificationGas = Number(op2.preVerificationGas) + extraPreVerificationGas;
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
        console.log("chainId===", chainId)
        console.log("entryPoint===", entryPoint)
        console.log("packUserOp(op, true)===", packUserOp(op, false))
        console.log("userOpHash===", userOpHash)
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
    // helper to fill structure:
    // - default callGasLimit to estimate call from entryPoint to account (TODO: add overhead)
    // if there is initCode:
    //  - calculate sender by eth_call the deployment code
    //  - default verificationGasLimit estimateGas of deployment code plus default 100000
    // no initCode:
    //  - update nonce from account.getNonce()
    // entryPoint param is only required to fill in "sender address when specifying "initCode"
    // nonce: assume contract as "getNonce()" function, and fill in.
    // sender - only in case of construction: fill sender from initCode.
    // callGasLimit: VERY crude estimation (by estimating call to account, and add rough entryPoint overhead
    // verificationGasLimit: hard-code default at 100k. should add "create2" cost
    async function fillUserOp(
        op: Partial<UserOperation>,
        // entryPoint?: EntryPoint,
        getNonceFunction = "nonce",
        useNonceKey = true,
        nonceKey = 0
    ): Promise<UserOperation> {
        const op1 = { ...op };
        console.log(op1)
        // const provider = ethers.provider
        // if (op.initCode != null) {
        //     const initAddr = hexDataSlice(op1.initCode!, 0, 20);
        //     const initCallData = hexDataSlice(op1.initCode!, 20);
        //     if (op1.nonce == null) op1.nonce = 0;
        //     if (op1.sender == null) {
        //         // hack: if the init contract is our known deployer, then we know what the address would be, without a view call
        //         if (
        //             initAddr.toLowerCase() === Create2Factory.contractAddress.toLowerCase()
        //         ) {
        //             const ctr = hexDataSlice(initCallData, 32);
        //             const salt = hexDataSlice(initCallData, 0, 32);
        //             op1.sender = Create2Factory.getDeployedAddress(ctr, salt);
        //         } else {
        //             // console.log('\t== not our deployer. our=', Create2Factory.contractAddress, 'got', initAddr)
        //             if (provider == null) throw new Error("no entrypoint/provider");
        //             op1.sender = await entryPoint!.callStatic
        //                 .getSenderAddress(op1.initCode!)
        //                 .catch((e) => e.errorArgs.sender);
        //         }
        //     }
        //     if (op1.verificationGasLimit == null) {
        //         if (provider == null) throw new Error("no entrypoint/provider");
        //         let initEstimate;
        //         try {
        //             initEstimate = await provider.estimateGas({
        //                 from: entryPoint?.address,
        //                 to: initAddr,
        //                 data: initCallData,
        //                 gasLimit: 10e6,
        //             });
        //         } catch (error) {
        //             initEstimate = 1_000_000;
        //         }
        //         op1.verificationGasLimit = BigNumber.from(
        //             DefaultsForUserOp.verificationGasLimit
        //         ).add(initEstimate);
        //     }
        // }
        if (op1.nonce == null) {
            op1.nonce = DefaultsForUserOp.nonce
            // if (provider == null)
            //     throw new Error("must have entryPoint to autofill nonce");
            // // Review/TODO: if someone passes 'nonce' as nonceFunction. or change the default

            // if (useNonceKey) {
            //     const c = new Contract(
            //         op.sender!,
            //         [`function nonce(uint192) view returns(uint256)`],
            //         provider
            //     );
            //     op1.nonce = await c.nonce(nonceKey).catch();
            // } else {
            //     const c = new Contract(
            //         op.sender!,
            //         [`function ${getNonceFunction}() view returns(uint256)`],
            //         provider
            //     );
            //     op1.nonce = await c[getNonceFunction]().catch();
            // }
        }
        if (op1.callGasLimit == null && op.callData != null) {
            // if (provider == null)
            //     throw new Error("must have entryPoint for callGasLimit estimate");
            // let gasEstimated;
            // try {
            //     // gasEstimated = await provider.estimateGas({
            //     //     from: entryPoint?.target,
            //     //     to: op1.sender,
            //     //     data: op1.callData?.toString(),
            //     // });
            //     gasEstimated = 3_000_000;

            // } catch (error) {
            //     // to handle the case when we need to build an userOp that is expected to fail
            //     gasEstimated = 3_000_000;
            // }

            // console.log('estim', op1.sender,'len=', op1.callData!.length, 'res=', gasEstimated)
            // estimateGas assumes direct call from entryPoint. add wrapper cost.
            op1.callGasLimit = 3_000_000; // .add(55000)
        }
        if (op1.maxFeePerGas == null) {
            // if (provider == null)
            // throw new Error("must have entryPoint to autofill maxFeePerGas");
            const baseFeePerGas = await ethers.provider.getBlock("latest");
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
    it("setUp", async () => {
        await loadFixture(setUp)
    })
    // async function setupTestsFixture() {
    //     const [
    //         deployer,
    //         smartAccountOwner,
    //         alice,
    //         charlie,
    //         sessionKey,
    //     ] = await ethers.getSigners();
    //     const mockNFT = await (
    //         await ethers.getContractFactory("MockNFT")
    //     ).deploy();
    //     const entryPoint = await getEntryPoint();
    //     const ecdsaOwnershipRegistryModule = await getEcdsaOwnershipRegistryModule();
    //     const EcdsaOwnershipRegistryModule = await ethers.getContractFactory(
    //         "EcdsaOwnershipRegistryModule"
    //     );
    //     const ecdsaOwnershipSetupData =
    //         EcdsaOwnershipRegistryModule.interface.encodeFunctionData(
    //             "initForSmartAccount",
    //             [await smartAccountOwner.getAddress()]
    //         );
    //     const smartAccountDeploymentIndex = 0;
    //     const userSA = await getSmartAccountWithModule(
    //         await ecdsaOwnershipRegistryModule.getAddress(),
    //         ecdsaOwnershipSetupData,
    //         smartAccountDeploymentIndex
    //     );

    //     // send funds to userSA and mint tokens
    //     await deployer.sendTransaction({
    //         to: await userSA.getAddress(),
    //         value: ethers.parseEther("10"),
    //     });
    //     await mockNFT.mintNext(await userSA.getAddress());

    //     // deploy session key manager module and enable it in the smart account
    //     const sessionKeyManager = await (
    //         await ethers.getContractFactory("SessionKeyManager")
    //     ).deploy();
    //     // const userOp = await makeEcdsaModuleUserOp(
    //     //     "enableModule",
    //     //     [await sessionKeyManager.getAddress()],
    //     //     await userSA.getAddress(),
    //     //     smartAccountOwner,
    //     //     entryPoint,
    //     //     await ecdsaOwnershipRegistryModule.getAddress()
    //     // );
    //     // await entryPoint.handleOps([userOp], alice.address);

    //     const contractAddressSVM = await (
    //         await ethers.getContractFactory(
    //             "ContractAddressSessionValidationModule"
    //         )
    //     ).deploy();

    //     const sessionKeyData = ethers.AbiCoder.defaultAbiCoder().encode(
    //         ["address", "address[]"],
    //         [sessionKey.address, [await mockNFT.getAddress()]]
    //     );

    //     const leafData = ethers.AbiCoder.defaultAbiCoder().encode(
    //         ["uint48", "uint48", "address", "bytes"],
    //         [0, 0, await contractAddressSVM.getAddress(), sessionKeyData]
    //     );

    //     // const leafData = hexConcat([
    //     //     hexZeroPad(ethers.hexlify("0"), 6),
    //     //     hexZeroPad(ethers.hexlify("0"), 6),
    //     //     hexZeroPad(await contractAddressSVM.getAddress(), 20),
    //     //     sessionKeyData,
    //     // ]);

    //     // const merkleTree = await enableNewTreeForSmartAccountViaEcdsa(
    //     //     [ethers.keccak256(leafData)],
    //     //     sessionKeyManager.attach(await sessionKeyManager.getAddress()),
    //     //     await userSA.getAddress(),
    //     //     smartAccountOwner,
    //     //     entryPoint,
    //     //     await ecdsaOwnershipRegistryModule.getAddress()
    //     // );

    //     return {
    //         entryPoint: entryPoint,
    //         ecdsaOwnershipRegistryModule: ecdsaOwnershipRegistryModule,
    //         userSA: userSA,
    //         mockNFT: mockNFT,
    //         sessionKeyManager: sessionKeyManager,
    //         contractAddressSVM: contractAddressSVM,
    //         sessionKeyData: sessionKeyData,
    //         leafData: leafData,
    //         charlie: charlie,
    //         sessionKey: sessionKey,
    //         alice: alice
    //     };
    // }
    // it("should be able to process Session Key signed userOp", async () => {
    //     const {
    //         entryPoint,
    //         userSA,
    //         sessionKeyManager,
    //         contractAddressSVM,
    //         sessionKeyData,
    //         leafData,
    //         merkleTree,
    //         mockNFT,
    //         charlie,
    //         sessionKey,
    //         alice
    //     } = await loadFixture(setupTestsFixture);
    // });

    // it("should be able to process Session Key signed userOp", async () => {
    //     const {
    //         entryPoint,
    //         userSA,
    //         sessionKeyManager,
    //         contractAddressSVM,
    //         sessionKeyData,
    //         leafData,
    //         merkleTree,
    //         mockNFT,
    //         charlie,
    //         sessionKey,
    //         alice
    //     } = await loadFixture(setupTestsFixture);
    //     const Erc721 = await ethers.getContractFactory("MockNFT");

    //     const approvalUserOp = await makeEcdsaSessionKeySignedUserOp(
    //         "execute",
    //         [
    //             await mockNFT.getAddress(),
    //             0,
    //             Erc721.interface.encodeFunctionData("setApprovalForAll", [
    //                 charlie.address,
    //                 true,
    //             ]),
    //         ],
    //         await userSA.getAddress(),
    //         sessionKey,
    //         entryPoint,
    //         await sessionKeyManager.getAddress(),
    //         0,
    //         0,
    //         await contractAddressSVM.getAddress(),
    //         sessionKeyData,
    //         merkleTree.getHexProof(ethers.keccak256(leafData))
    //     );

    //     expect(
    //         await mockNFT.isApprovedForAll(await userSA.getAddress(), charlie.address)
    //     ).to.equal(false);
    //     await entryPoint.handleOps([approvalUserOp], alice.address, {
    //         gasLimit: 10000000,
    //     });
    //     expect(
    //         await mockNFT.isApprovedForAll(await userSA.getAddress(), charlie.address)
    //     ).to.equal(true);
    // });

    // it("should revert if trying to approve wrong NFTs", async () => {
    //     const {
    //         entryPoint,
    //         userSA,
    //         sessionKeyManager,
    //         contractAddressSVM,
    //         sessionKeyData,
    //         leafData,
    //         merkleTree,
    //         mockNFT,
    //     } = await setupTests();
    //     const Erc721 = await ethers.getContractFactory("MockNFT");
    //     const randomNFT = await (
    //         await ethers.getContractFactory("MockNFT")
    //     ).deploy();

    //     const approvalUserOp = await makeEcdsaSessionKeySignedUserOp(
    //         "execute",
    //         [
    //             randomNFT.address,
    //             0,
    //             Erc721.interface.encodeFunctionData("setApprovalForAll", [
    //                 charlie.address,
    //                 true,
    //             ]),
    //         ],
    //         userSA.address,
    //         sessionKey,
    //         entryPoint,
    //         sessionKeyManager.address,
    //         0,
    //         0,
    //         contractAddressSVM.address,
    //         sessionKeyData,
    //         merkleTree.getHexProof(ethers.utils.keccak256(leafData))
    //     );

    //     await expect(
    //         entryPoint.handleOps([approvalUserOp], alice.address, {
    //             gasLimit: 10000000,
    //         })
    //     )
    //         .to.be.revertedWith("FailedOp")
    //         .withArgs(
    //             0,
    //             "AA23 reverted: ContractAddressSessionValidationModule: wrong target contract address"
    //         );

    //     expect(
    //         await mockNFT.isApprovedForAll(userSA.address, charlie.address)
    //     ).to.equal(false);
    //     expect(
    //         await randomNFT.isApprovedForAll(userSA.address, charlie.address)
    //     ).to.equal(false);
    // });
});