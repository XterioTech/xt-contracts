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

        const ERC721NFT = await (await ethers.getContractFactory("TestERC721PublicMint")).deploy();

        const sessionKey = await sessionKeySigner.getAddress();
        const targetAddresses = [ERC721NFT.target];
        const sessionKeyData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address[]"],
            [sessionKey, targetAddresses]
        );

        const leafData = ethers.solidityPacked(
            ["uint48", "uint48", "address", "bytes"],
            [0, 0, contractAddressSVM.target, sessionKeyData]
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
            ERC721NFT
        }
    }

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
            ERC721NFT,
            sessionKeySigner,
        } = await loadFixture(setUp);
        const ERC721NFTContract = await ethers.getContractFactory("TestERC721PublicMint");

        const approvalUserOp = await makeEcdsaSessionKeySignedUserOp(
            "execute",
            [
                await ERC721NFT.getAddress(),
                0,
                ERC721NFTContract.interface.encodeFunctionData("setApprovalForAll", [
                    await deployerSigner.getAddress(),
                    true,
                ]),
            ],
            await userSA.getAddress(),
            sessionKeySigner,
            entryPoint,
            await sessionKeyManager.getAddress(),
            0,
            0,
            await contractAddressSVM.getAddress(),
            sessionKeyData,
            merkleTree.getHexProof(ethers.keccak256(leafData))
        );

        expect(
            await ERC721NFT.isApprovedForAll(await userSA.getAddress(), await deployerSigner.getAddress())
        ).to.equal(false);
        await entryPoint.handleOps([approvalUserOp], await deployerSigner.getAddress());
        expect(
            await ERC721NFT.isApprovedForAll(await userSA.getAddress(), await deployerSigner.getAddress())
        ).to.equal(true);
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
            ERC721NFT,
            sessionKeySigner,
        } = await loadFixture(setUp);
        const ERC721NFTContract = await ethers.getContractFactory("TestERC721PublicMint");
        const WrongERC721NFT = await (
            await ethers.getContractFactory("TestERC721PublicMint")
        ).deploy();

        const approvalUserOp = await makeEcdsaSessionKeySignedUserOp(
            "execute",
            [
                await WrongERC721NFT.getAddress(),
                0,
                ERC721NFTContract.interface.encodeFunctionData("setApprovalForAll", [
                    await deployerSigner.getAddress(),
                    true,
                ]),
            ],
            await userSA.getAddress(),
            sessionKeySigner,
            entryPoint,
            await sessionKeyManager.getAddress(),
            0,
            0,
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
            await ERC721NFT.isApprovedForAll(await userSA.getAddress(), await deployerSigner.getAddress())
        ).to.equal(false);
        expect(
            await WrongERC721NFT.isApprovedForAll(await userSA.getAddress(), await deployerSigner.getAddress())
        ).to.equal(false);
    });
});