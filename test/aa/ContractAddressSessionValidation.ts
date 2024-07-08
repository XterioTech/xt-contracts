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
            deployer,
            smartAccountOwner,
            sessionKey,
        ] = await ethers.getSigners();

        const entryPoint = await getEntryPoint();

        const ecdsaOwnershipRegistryModule = await getEcdsaOwnershipRegistryModule();

        const smartAccountImplementation = await getSmartAccountImplementation(entryPoint.target);

        const smartAccountFactory = await getSmartAccountFactory(smartAccountImplementation.target, await deployer.getAddress());

        const initForSmartAccountData = ecdsaOwnershipRegistryModule.interface.encodeFunctionData("initForSmartAccount", [await smartAccountOwner.getAddress()]);
        const index = 0;
        const expectedSmartAccountAddress = await smartAccountFactory.getAddressForCounterFactualAccount(ecdsaOwnershipRegistryModule.target, initForSmartAccountData, index);
        await smartAccountFactory.deployCounterFactualAccount(ecdsaOwnershipRegistryModule.target, initForSmartAccountData, index);
        const userSA = await ethers.getContractAt("SmartAccount", expectedSmartAccountAddress);

        await deployer.sendTransaction({
            to: userSA.target,
            value: ethers.parseEther("100"),
        });


        const sessionKeyManager = await getSessionKeyManager();

        const userOp = await makeUserOp("enableModule", [sessionKeyManager.target], await userSA.getAddress(), smartAccountOwner, entryPoint, await ecdsaOwnershipRegistryModule.getAddress());
        await entryPoint.handleOps([userOp], await smartAccountOwner.getAddress());

        // 
        const contractAddressSVM = await (await ethers.getContractFactory("ContractAddressSessionValidationModule")).deploy();

        const mockNFT = await (await ethers.getContractFactory("MockNFT")).deploy();

        const sessionKeyData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address[]"],
            [await sessionKey.getAddress(), [mockNFT.target]]
        );
        const leafData = ethers.solidityPacked(
            ["uint48", "uint48", "address", "bytes"],
            [0, 0, contractAddressSVM.target, sessionKeyData]
        );

        const merkleTree = await enableNewTreeForSmartAccountViaEcdsa([ethers.keccak256(leafData)], await sessionKeyManager.getAddress(), await userSA.getAddress(), smartAccountOwner, entryPoint, await ecdsaOwnershipRegistryModule.getAddress());

        return {
            entryPoint,
            ecdsaOwnershipRegistryModule,
            userSA,
            sessionKeyManager,
            deployer,
            smartAccountOwner,
            sessionKey,
            sessionKeyData,
            leafData,
            merkleTree,
            contractAddressSVM,
            mockNFT
        }
    }

    it("should be able to process Session with specified contract address", async () => {
        const {
            deployer,
            entryPoint,
            userSA,
            sessionKeyManager,
            contractAddressSVM,
            sessionKeyData,
            leafData,
            merkleTree,
            mockNFT,
            sessionKey,
        } = await loadFixture(setUp);
        const Erc721 = await ethers.getContractFactory("MockNFT");

        const approvalUserOp = await makeEcdsaSessionKeySignedUserOp(
            "execute",
            [
                await mockNFT.getAddress(),
                0,
                Erc721.interface.encodeFunctionData("setApprovalForAll", [
                    await deployer.getAddress(),
                    true,
                ]),
            ],
            await userSA.getAddress(),
            sessionKey,
            entryPoint,
            await sessionKeyManager.getAddress(),
            0,
            0,
            await contractAddressSVM.getAddress(),
            sessionKeyData,
            merkleTree.getHexProof(ethers.keccak256(leafData))
        );

        expect(
            await mockNFT.isApprovedForAll(await userSA.getAddress(), await deployer.getAddress())
        ).to.equal(false);
        await entryPoint.handleOps([approvalUserOp], await deployer.getAddress());
        expect(
            await mockNFT.isApprovedForAll(await userSA.getAddress(), await deployer.getAddress())
        ).to.equal(true);
    });

    it("should revert if trying to use wrong contract address", async () => {
        const {
            deployer,
            entryPoint,
            userSA,
            sessionKeyManager,
            contractAddressSVM,
            sessionKeyData,
            leafData,
            merkleTree,
            mockNFT,
            sessionKey,
        } = await loadFixture(setUp);
        const Erc721 = await ethers.getContractFactory("MockNFT");
        const randomNFT = await (
            await ethers.getContractFactory("MockNFT")
        ).deploy();

        const approvalUserOp = await makeEcdsaSessionKeySignedUserOp(
            "execute",
            [
                await randomNFT.getAddress(),
                0,
                Erc721.interface.encodeFunctionData("setApprovalForAll", [
                    await deployer.getAddress(),
                    true,
                ]),
            ],
            await userSA.getAddress(),
            sessionKey,
            entryPoint,
            await sessionKeyManager.getAddress(),
            0,
            0,
            await contractAddressSVM.getAddress(),
            sessionKeyData,
            merkleTree.getHexProof(ethers.keccak256(leafData))
        );

        await expect(
            entryPoint.handleOps([approvalUserOp], await deployer.getAddress(), {
                gasLimit: 10000000,
            })
        )
            .to.be.rejectedWith(
                "AA23 reverted: ContractAddressSessionValidationModule: wrong target contract address"
            );

        expect(
            await mockNFT.isApprovedForAll(await userSA.getAddress(), await deployer.getAddress())
        ).to.equal(false);
        expect(
            await randomNFT.isApprovedForAll(await userSA.getAddress(), await deployer.getAddress())
        ).to.equal(false);
    });
});