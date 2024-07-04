import { expect } from "chai";
import {
    makeEcdsaSessionKeySignedUserOp,
    enableNewTreeForSmartAccountViaEcdsa,
} from "./utils/sessionKey";
import { ethers, deployments, waffle } from "hardhat";
import { makeEcdsaModuleUserOp } from "./utils/userOp";
import {
    getEntryPoint,
    getEcdsaOwnershipRegistryModule,
    getSmartAccountWithModule,
} from "./utils/setupHelper";
import { hexZeroPad, hexConcat } from "ethers/lib/utils";

describe("SessionKey: Contract Address Session Validation Module", async () => {
    const [
        deployer,
        smartAccountOwner,
        alice,
        charlie,
        sessionKey,
    ] = waffle.provider.getWallets();

    const setupTests = deployments.createFixture(
        async ({ deployments }) => {
            await deployments.fixture();
            const mockNFT = await (
                await ethers.getContractFactory("MockNFT")
            ).deploy();
            const entryPoint = await getEntryPoint();
            const ecdsaModule = await getEcdsaOwnershipRegistryModule();
            const EcdsaOwnershipRegistryModule = await ethers.getContractFactory(
                "EcdsaOwnershipRegistryModule"
            );
            const ecdsaOwnershipSetupData =
                EcdsaOwnershipRegistryModule.interface.encodeFunctionData(
                    "initForSmartAccount",
                    [await smartAccountOwner.getAddress()]
                );
            const smartAccountDeploymentIndex = 0;
            const userSA = await getSmartAccountWithModule(
                ecdsaModule.address,
                ecdsaOwnershipSetupData,
                smartAccountDeploymentIndex
            );

            // send funds to userSA and mint tokens
            await deployer.sendTransaction({
                to: userSA.address,
                value: ethers.utils.parseEther("10"),
            });
            await mockNFT.mintNext(userSA.address);

            // deploy session key manager module and enable it in the smart account
            const sessionKeyManager = await (
                await ethers.getContractFactory("SessionKeyManager")
            ).deploy();
            const userOp = await makeEcdsaModuleUserOp(
                "enableModule",
                [sessionKeyManager.address],
                userSA.address,
                smartAccountOwner,
                entryPoint,
                ecdsaModule.address
            );
            await entryPoint.handleOps([userOp], alice.address);

            const contractAddressSVM = await (
                await ethers.getContractFactory(
                    "ContractAddressSessionValidationModule"
                )
            ).deploy();

            const sessionKeyData = ethers.utils.defaultAbiCoder.encode(
                ["address", "address[]"],
                [sessionKey.address, [mockNFT.address]]
            );

            const leafData = hexConcat([
                hexZeroPad(ethers.utils.hexlify(0), 6),
                hexZeroPad(ethers.utils.hexlify(0), 6),
                hexZeroPad(contractAddressSVM.address, 20),
                sessionKeyData,
            ]);

            const merkleTree = await enableNewTreeForSmartAccountViaEcdsa(
                [ethers.utils.keccak256(leafData)],
                sessionKeyManager,
                userSA.address,
                smartAccountOwner,
                entryPoint,
                ecdsaModule.address
            );

            return {
                entryPoint: entryPoint,
                ecdsaModule: ecdsaModule,
                userSA: userSA,
                mockNFT: mockNFT,
                sessionKeyManager: sessionKeyManager,
                contractAddressSVM: contractAddressSVM,
                sessionKeyData: sessionKeyData,
                leafData: leafData,
                merkleTree: merkleTree,
            };
        }
    );

    it("should be able to process Session Key signed userOp", async () => {
        const {
            entryPoint,
            userSA,
            sessionKeyManager,
            contractAddressSVM,
            sessionKeyData,
            leafData,
            merkleTree,
            mockNFT,
        } = await setupTests();
        const Erc721 = await ethers.getContractFactory("MockNFT");

        const approvalUserOp = await makeEcdsaSessionKeySignedUserOp(
            "execute",
            [
                mockNFT.address,
                0,
                Erc721.interface.encodeFunctionData("setApprovalForAll", [
                    charlie.address,
                    true,
                ]),
            ],
            userSA.address,
            sessionKey,
            entryPoint,
            sessionKeyManager.address,
            0,
            0,
            contractAddressSVM.address,
            sessionKeyData,
            merkleTree.getHexProof(ethers.utils.keccak256(leafData))
        );

        expect(
            await mockNFT.isApprovedForAll(userSA.address, charlie.address)
        ).to.equal(false);
        await entryPoint.handleOps([approvalUserOp], alice.address, {
            gasLimit: 10000000,
        });
        expect(
            await mockNFT.isApprovedForAll(userSA.address, charlie.address)
        ).to.equal(true);
    });

    it("should revert if trying to approve wrong NFTs", async () => {
        const {
            entryPoint,
            userSA,
            sessionKeyManager,
            contractAddressSVM,
            sessionKeyData,
            leafData,
            merkleTree,
            mockNFT,
        } = await setupTests();
        const Erc721 = await ethers.getContractFactory("MockNFT");
        const randomNFT = await (
            await ethers.getContractFactory("MockNFT")
        ).deploy();

        const approvalUserOp = await makeEcdsaSessionKeySignedUserOp(
            "execute",
            [
                randomNFT.address,
                0,
                Erc721.interface.encodeFunctionData("setApprovalForAll", [
                    charlie.address,
                    true,
                ]),
            ],
            userSA.address,
            sessionKey,
            entryPoint,
            sessionKeyManager.address,
            0,
            0,
            contractAddressSVM.address,
            sessionKeyData,
            merkleTree.getHexProof(ethers.utils.keccak256(leafData))
        );

        await expect(
            entryPoint.handleOps([approvalUserOp], alice.address, {
                gasLimit: 10000000,
            })
        )
            .to.be.revertedWith("FailedOp")
            .withArgs(
                0,
                "AA23 reverted: ContractAddressSessionValidationModule: wrong target contract address"
            );

        expect(
            await mockNFT.isApprovedForAll(userSA.address, charlie.address)
        ).to.equal(false);
        expect(
            await randomNFT.isApprovedForAll(userSA.address, charlie.address)
        ).to.equal(false);
    });
});