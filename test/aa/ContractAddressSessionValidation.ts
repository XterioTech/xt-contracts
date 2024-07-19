import { expect } from "chai";
import {
    makeEcdsaSessionKeySignedUserOp,
    enableNewTreeForSmartAccountViaEcdsa,
} from "./utils/sessionKey";
import { ethers } from "hardhat";
import { makeUserOp } from "./utils/userOp";
import {
    getEntryPoint,
    getEcdsaOwnershipRegistryModule,
    getSessionKeyManager,
    getSmartAccountImplementation,
    getSmartAccountFactory
} from "./utils/setupHelper";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("SessionKey: Contract Address Session Validation Module", function () {
    async function setUp() {
        const [
            deployerSigner,
            smartAccountOwnerSigner,
            sessionKeySigner,
        ] = await ethers.getSigners();

        const entryPoint = await getEntryPoint();

        const ecdsaOwnershipRegistryModule = await getEcdsaOwnershipRegistryModule();

        const smartAccountImplementation = await getSmartAccountImplementation(entryPoint.target);

        const smartAccountFactory = await getSmartAccountFactory(smartAccountImplementation.target, await deployerSigner.getAddress());

        const initForSmartAccountData = ecdsaOwnershipRegistryModule.interface.encodeFunctionData("initForSmartAccount", [await smartAccountOwnerSigner.getAddress()]);
        const index = 0;
        const expectedSmartAccountAddress = await smartAccountFactory.getAddressForCounterFactualAccount(ecdsaOwnershipRegistryModule.target, initForSmartAccountData, index);
        await smartAccountFactory.deployCounterFactualAccount(ecdsaOwnershipRegistryModule.target, initForSmartAccountData, index);
        const userSA = await ethers.getContractAt("SmartAccount", expectedSmartAccountAddress);

        await deployerSigner.sendTransaction({
            to: userSA.target,
            value: ethers.parseEther("100"),
        });


        const sessionKeyManager = await getSessionKeyManager();
        const userOp = await makeUserOp("enableModule", [sessionKeyManager.target], await userSA.getAddress(), smartAccountOwnerSigner, entryPoint, await ecdsaOwnershipRegistryModule.getAddress());
        await entryPoint.handleOps([userOp], await smartAccountOwnerSigner.getAddress());

        // 
        const contractAddressSVM = await (await ethers.getContractFactory("ContractAddressSessionValidationModule")).deploy();

        const ERC1155NFT = await (await ethers.getContractFactory("ERC1155NFT")).deploy();

        const sessionKey = await sessionKeySigner.getAddress();
        const targetAddresses = [ERC1155NFT.target];
        const sessionKeyData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address[]"],
            [sessionKey, targetAddresses]
        );
        const currentTime = Date.parse(new Date().toString()) / 1000;
        const validUntil = currentTime + 1800; // sessoin key 过期时间，当前时间 + 30 分钟
        const validAfter = currentTime + 600; // session key 开始时间，当前时间 + 10 分钟

        const leafData = ethers.solidityPacked(
            ["uint48", "uint48", "address", "bytes"],
            [validUntil, validAfter, contractAddressSVM.target, sessionKeyData]
        );

        const merkleTree = await enableNewTreeForSmartAccountViaEcdsa([ethers.keccak256(leafData)], await sessionKeyManager.getAddress(), await userSA.getAddress(), smartAccountOwnerSigner, entryPoint, await ecdsaOwnershipRegistryModule.getAddress());

        return {
            entryPoint,
            ecdsaOwnershipRegistryModule,
            userSA,
            sessionKeyManager,
            deployerSigner,
            smartAccountOwnerSigner,
            sessionKeySigner,
            sessionKeyData,
            leafData,
            merkleTree,
            contractAddressSVM,
            ERC1155NFT,
            validUntil,
            validAfter,
        }
    }

    it("the validAfter time was not reached", async () => {
        const {
            deployerSigner,
            entryPoint,
            userSA,
            sessionKeyManager,
            contractAddressSVM,
            sessionKeyData,
            leafData,
            merkleTree,
            ERC1155NFT,
            sessionKeySigner,
            validUntil,
            validAfter,
        } = await loadFixture(setUp);
        const ERC1155NFTContract = await ethers.getContractFactory("ERC1155NFT");

        const approvalUserOp = await makeEcdsaSessionKeySignedUserOp(
            "execute",
            [
                await ERC1155NFT.getAddress(),
                0,
                ERC1155NFTContract.interface.encodeFunctionData("setApprovalForAll", [
                    await deployerSigner.getAddress(),
                    true,
                ]),
            ],
            await userSA.getAddress(),
            sessionKeySigner,
            entryPoint,
            await sessionKeyManager.getAddress(),
            validUntil,
            validAfter,
            await contractAddressSVM.getAddress(),
            sessionKeyData,
            merkleTree.getHexProof(ethers.keccak256(leafData))
        );

        expect(
            await ERC1155NFT.isApprovedForAll(await userSA.getAddress(), await deployerSigner.getAddress())
        ).to.equal(false);
        await expect(entryPoint.handleOps([approvalUserOp], await deployerSigner.getAddress())).to.be.rejectedWith(
            "AA22 expired or not due"
        );
        expect(
            await ERC1155NFT.isApprovedForAll(await userSA.getAddress(), await deployerSigner.getAddress())
        ).to.equal(false);
    });

    it("should be able to process Session with specified contract address", async () => {
        const {
            deployerSigner,
            entryPoint,
            userSA,
            sessionKeyManager,
            contractAddressSVM,
            sessionKeyData,
            leafData,
            merkleTree,
            ERC1155NFT,
            sessionKeySigner,
            validUntil,
            validAfter,
        } = await loadFixture(setUp);
        // set the blockchain timestamp
        await ethers.provider.send("evm_setNextBlockTimestamp", [validAfter + 1]);

        const ERC1155NFTContract = await ethers.getContractFactory("ERC1155NFT");

        const approvalUserOp = await makeEcdsaSessionKeySignedUserOp(
            "execute",
            [
                await ERC1155NFT.getAddress(),
                0,
                ERC1155NFTContract.interface.encodeFunctionData("setApprovalForAll", [
                    await deployerSigner.getAddress(),
                    true,
                ]),
            ],
            await userSA.getAddress(),
            sessionKeySigner,
            entryPoint,
            await sessionKeyManager.getAddress(),
            validUntil,
            validAfter,
            await contractAddressSVM.getAddress(),
            sessionKeyData,
            merkleTree.getHexProof(ethers.keccak256(leafData))
        );

        expect(
            await ERC1155NFT.isApprovedForAll(await userSA.getAddress(), await deployerSigner.getAddress())
        ).to.equal(false);
        await entryPoint.handleOps([approvalUserOp], await deployerSigner.getAddress());
        expect(
            await ERC1155NFT.isApprovedForAll(await userSA.getAddress(), await deployerSigner.getAddress())
        ).to.equal(true);
    });

    it("exceeds the validUntil time", async () => {
        const {
            deployerSigner,
            entryPoint,
            userSA,
            sessionKeyManager,
            contractAddressSVM,
            sessionKeyData,
            leafData,
            merkleTree,
            ERC1155NFT,
            sessionKeySigner,
            validUntil,
            validAfter,
        } = await loadFixture(setUp);
        // set the blockchain timestamp
        await ethers.provider.send("evm_setNextBlockTimestamp", [validUntil + 1]);

        const ERC1155NFTContract = await ethers.getContractFactory("ERC1155NFT");

        const approvalUserOp = await makeEcdsaSessionKeySignedUserOp(
            "execute",
            [
                await ERC1155NFT.getAddress(),
                0,
                ERC1155NFTContract.interface.encodeFunctionData("setApprovalForAll", [
                    await deployerSigner.getAddress(),
                    true,
                ]),
            ],
            await userSA.getAddress(),
            sessionKeySigner,
            entryPoint,
            await sessionKeyManager.getAddress(),
            validUntil,
            validAfter,
            await contractAddressSVM.getAddress(),
            sessionKeyData,
            merkleTree.getHexProof(ethers.keccak256(leafData))
        );

        expect(
            await ERC1155NFT.isApprovedForAll(await userSA.getAddress(), await deployerSigner.getAddress())
        ).to.equal(false);
        await expect(entryPoint.handleOps([approvalUserOp], await deployerSigner.getAddress())).to.be.rejectedWith(
            "AA22 expired or not due"
        );
        expect(
            await ERC1155NFT.isApprovedForAll(await userSA.getAddress(), await deployerSigner.getAddress())
        ).to.equal(false);
    });

    it("should revert if trying to use wrong contract address", async () => {
        const {
            deployerSigner,
            entryPoint,
            userSA,
            sessionKeyManager,
            contractAddressSVM,
            sessionKeyData,
            leafData,
            merkleTree,
            ERC1155NFT,
            sessionKeySigner,
            validUntil,
            validAfter,
        } = await loadFixture(setUp);
        const ERC1155NFTContract = await ethers.getContractFactory("ERC1155NFT");
        const WrongERC1155NFT = await (
            await ethers.getContractFactory("ERC1155NFT")
        ).deploy();

        const approvalUserOp = await makeEcdsaSessionKeySignedUserOp(
            "execute",
            [
                await WrongERC1155NFT.getAddress(),
                0,
                ERC1155NFTContract.interface.encodeFunctionData("setApprovalForAll", [
                    await deployerSigner.getAddress(),
                    true,
                ]),
            ],
            await userSA.getAddress(),
            sessionKeySigner,
            entryPoint,
            await sessionKeyManager.getAddress(),
            validUntil,
            validAfter,
            await contractAddressSVM.getAddress(),
            sessionKeyData,
            merkleTree.getHexProof(ethers.keccak256(leafData))
        );

        await expect(
            entryPoint.handleOps([approvalUserOp], await deployerSigner.getAddress(), {
                gasLimit: 10000000,
            })
        )
            .to.be.rejectedWith(
                "AA23 reverted: ContractAddressSessionValidationModule: wrong target contract address"
            );

        expect(
            await ERC1155NFT.isApprovedForAll(await userSA.getAddress(), await deployerSigner.getAddress())
        ).to.equal(false);
        expect(
            await WrongERC1155NFT.isApprovedForAll(await userSA.getAddress(), await deployerSigner.getAddress())
        ).to.equal(false);
    });
});