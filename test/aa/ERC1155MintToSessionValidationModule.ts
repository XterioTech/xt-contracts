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
            bobSigner,
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
        const ERC1155MintToSVM = await (await ethers.getContractFactory("ERC1155MintToSessionValidationModule")).deploy();

        const ERC1155NFT = await (await ethers.getContractFactory("ERC1155NFT")).deploy();

        const sessionKey = await sessionKeySigner.getAddress();
        const recipient = await bobSigner.getAddress();
        const tokenId = 1;
        const ERC1155NFTAddress = await ERC1155NFT.getAddress();
        const sessionKeyData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "uint256", "address",],
            [sessionKey, recipient, tokenId, ERC1155NFTAddress]
        );

        const leafData = ethers.solidityPacked(
            ["uint48", "uint48", "address", "bytes"],
            [0, 0, ERC1155MintToSVM.target, sessionKeyData]
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
            ERC1155MintToSVM,
            ERC1155NFT,
            recipient,
            tokenId
        }
    }

    it("should be able to process Session key mint to nft", async () => {
        const {
            deployerSigner,
            entryPoint,
            userSA,
            sessionKeyManager,
            ERC1155MintToSVM,
            sessionKeyData,
            leafData,
            merkleTree,
            ERC1155NFT,
            sessionKeySigner,
            recipient,
            tokenId
        } = await loadFixture(setUp);
        const ERC1155NFTContract = await ethers.getContractFactory("ERC1155NFT");
        const mintToUserOp = await makeEcdsaSessionKeySignedUserOp(
            "execute",
            [
                await ERC1155NFT.getAddress(),
                0,
                ERC1155NFTContract.interface.encodeFunctionData("mintTo", [
                    recipient,
                    tokenId,
                    1,
                ]),
            ],
            await userSA.getAddress(),
            sessionKeySigner,
            entryPoint,
            await sessionKeyManager.getAddress(),
            0,
            0,
            await ERC1155MintToSVM.getAddress(),
            sessionKeyData,
            merkleTree.getHexProof(ethers.keccak256(leafData))
        );

        expect(
            await ERC1155NFT.balanceOf(recipient, tokenId)
        ).to.equal(0);
        await entryPoint.handleOps([mintToUserOp], await deployerSigner.getAddress());
        expect(
            await ERC1155NFT.balanceOf(recipient, tokenId)
        ).to.equal(1);
    });

    it("should revert if trying to use wrong ERC1155NFT contract address", async () => {
        const {
            deployerSigner,
            entryPoint,
            userSA,
            sessionKeyManager,
            ERC1155MintToSVM,
            sessionKeyData,
            leafData,
            merkleTree,
            ERC1155NFT,
            sessionKeySigner,
            recipient,
            tokenId
        } = await loadFixture(setUp);
        const ERC1155NFTContract = await ethers.getContractFactory("ERC1155NFT");

        const WrongERC1155NFT = await (
            await ethers.getContractFactory("ERC1155NFT")
        ).deploy();

        const mintToUserOp = await makeEcdsaSessionKeySignedUserOp(
            "execute",
            [
                await WrongERC1155NFT.getAddress(),
                0,
                ERC1155NFTContract.interface.encodeFunctionData("mintTo", [
                    recipient,
                    tokenId,
                    1,
                ]),
            ],
            await userSA.getAddress(),
            sessionKeySigner,
            entryPoint,
            await sessionKeyManager.getAddress(),
            0,
            0,
            await ERC1155MintToSVM.getAddress(),
            sessionKeyData,
            merkleTree.getHexProof(ethers.keccak256(leafData))
        );

        await expect(
            entryPoint.handleOps([mintToUserOp], await deployerSigner.getAddress(), {
                gasLimit: 10000000,
            })
        )
            .to.be.rejectedWith(
                "AA23 reverted: ERC1155MT Wrong Token"
            );

        expect(
            await ERC1155NFT.balanceOf(recipient, tokenId)
        ).to.equal(0);
        expect(
            await WrongERC1155NFT.balanceOf(recipient, tokenId)
        ).to.equal(0);
    });
});