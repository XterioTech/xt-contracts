import hre from "hardhat";
import { expect } from "chai";
import { deployedBytecode as CreatorTokenTransferValidatorBytecode } from "../../artifacts/@limitbreak/creator-token-contracts/contracts/utils/CreatorTokenTransferValidator.sol/CreatorTokenTransferValidator.json";
import { loadFixture, setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployForwarder, deployGateway } from "../../lib/deploy";

const nullAddr = "0x0000000000000000000000000000000000000000";
const defaultValidatorAddr = "0x0000721C310194CcfC01E523fc93C9cCcFa2A0Ac";
const whitelistedOperator = "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC";

describe("Test BasicERC721C Contract", function () {
  async function defaultFixture() {
    const [owner, gatewayAdmin, u0, u1, u2, u3, u4, u5] = await hre.ethers.getSigners();

    // Set LimitBreak CreatorTokenTransferValidator contract at certain addresses
    await setCode(defaultValidatorAddr, CreatorTokenTransferValidatorBytecode);
    const transferValidator = await hre.ethers.getContractAt("CreatorTokenTransferValidator", defaultValidatorAddr);
    await transferValidator.createOperatorWhitelist("default");
    //  cannot simulate default transfer validator's constructor func. so we deploy another one
    const TransferValidator = await hre.ethers.getContractFactory("CreatorTokenTransferValidator");
    const customValidator = await TransferValidator.deploy(owner.address);
    await customValidator.waitForDeployment();
    await customValidator.addOperatorToWhitelist(1, whitelistedOperator);

    const gateway = await deployGateway(gatewayAdmin.address);
    await gateway.connect(gatewayAdmin).addManager(gatewayAdmin.address);
    const forwarder = await deployForwarder();

    const MockMarket = await hre.ethers.getContractFactory("MockMarket");
    const mockMarket = await MockMarket.deploy();
    await mockMarket.waitForDeployment();

    const tokenName = "TestERC721";
    const tokenSymbol = "TE721";
    const baseURI = "https://api.test/meta/goerli";
    const BasicERC721C = await hre.ethers.getContractFactory("BasicERC721C");
    const erc721 = await BasicERC721C.deploy(tokenName, tokenSymbol, baseURI, gateway, forwarder);
    await erc721.waitForDeployment();

    return { owner, gatewayAdmin, u0, u1, u2, u3, u4, u5, gateway, customValidator, erc721, mockMarket };
  }

  it("Cannot transfer when paused", async function () {
    const { erc721, u0, u1 } = await loadFixture(defaultFixture);

    await erc721.mint(u1.address, 1);
    await erc721.pause();
    await expect(
      erc721.connect(u1)["safeTransferFrom(address,address,uint256)"](u1.address, u0.address, 1)
    ).to.be.revertedWith("Pausable: paused");
    await expect(erc721.mint(u1.address, 2)).to.be.revertedWith("Pausable: paused");
    await erc721.unpause();
    await erc721.connect(u1)["safeTransferFrom(address,address,uint256)"](u1.address, u0.address, 1);
    await erc721.mint(u1.address, 2);
  });

  it("ERC721C None Security Policy", async function () {
    const { erc721, mockMarket, u0, u1 } = await loadFixture(defaultFixture);

    /***************** Default None Security Policy ****************/
    expect(await erc721.getTransferValidator()).to.equal(nullAddr);
    await erc721.mint(u1.address, 1);
    await erc721.mint(u1.address, 2);
    // OTC Transfer
    await erc721.connect(u1)["safeTransferFrom(address,address,uint256)"](u1.address, u0.address, 1);
    expect(await erc721.ownerOf(1)).to.equal(u0.address);
    // Operator Transfer
    await expect(mockMarket.transferERC721(erc721, u1.address, u0.address, 2)).to.be.revertedWith(
      "ERC721: caller is not token owner or approved"
    );
    await erc721.connect(u1).setApprovalForAll(mockMarket, true);
    await mockMarket.transferERC721(erc721, u1.address, u0.address, 2);
    expect(await erc721.ownerOf(2)).to.equal(u0.address);
  });

  it("ERC721C SecurityPolicy LevelOne", async function () {
    const { erc721, mockMarket, customValidator, u0, u1, u2 } = await loadFixture(defaultFixture);
    await erc721.setToCustomValidatorAndSecurityPolicy(customValidator, 1, 1, 0);
    await erc721.mint(u1.address, 1);
    await erc721.mint(u1.address, 2);
    await erc721.mint(u1.address, 3);
    expect(await erc721.getTransferValidator()).to.equal(await customValidator.getAddress());
    expect(await erc721.isOperatorWhitelisted(whitelistedOperator)).to.equal(true);
    expect(await erc721.isOperatorWhitelisted(mockMarket)).to.equal(false);
    expect(await erc721.isTransferAllowed(whitelistedOperator, u1.address, u2.address)).to.equal(true);
    expect(await erc721.isTransferAllowed(mockMarket, u1.address, u2.address)).to.equal(false);
    // OTC Transfer
    await erc721.connect(u1)["safeTransferFrom(address,address,uint256)"](u1.address, u0.address, 1);
    expect(await erc721.ownerOf(1)).to.equal(u0.address);
    // Operator Transfer
    await erc721.connect(u1).setApprovalForAll(mockMarket, true);
    await expect(mockMarket.transferERC721(erc721, u1.address, u0.address, 2)).to.be.revertedWithCustomError(
      customValidator,
      "CreatorTokenTransferValidator__CallerMustBeWhitelistedOperator"
    );
    await customValidator.addOperatorToWhitelist(1, mockMarket);
    await mockMarket.transferERC721(erc721, u1.address, u0.address, 2);
    expect(await erc721.ownerOf(2)).to.equal(u0.address);
    // Transfer to contract
    await erc721.connect(u1).transferFrom(u1.address, mockMarket, 3);
    expect(await erc721.ownerOf(3)).to.equal(await mockMarket.getAddress());
  });

  it("ERC721C SecurityPolicy LevelTwo", async function () {
    const { erc721, mockMarket, customValidator, u0, u1, u2 } = await loadFixture(defaultFixture);
    await erc721.setToCustomValidatorAndSecurityPolicy(customValidator, 2, 1, 0);
    await erc721.mint(u1.address, 1);
    await erc721.mint(u1.address, 2);
    await erc721.mint(u1.address, 3);
    // OTC Transfer
    expect(
      erc721.connect(u1)["safeTransferFrom(address,address,uint256)"](u1.address, u0.address, 1)
    ).to.be.revertedWithCustomError(customValidator, "CreatorTokenTransferValidator__CallerMustBeWhitelistedOperator");
    // Operator Transfer
    await erc721.connect(u1).setApprovalForAll(mockMarket, true);
    await expect(mockMarket.transferERC721(erc721, u1.address, u0.address, 2)).to.be.revertedWithCustomError(
      customValidator,
      "CreatorTokenTransferValidator__CallerMustBeWhitelistedOperator"
    );
    await customValidator.addOperatorToWhitelist(1, await mockMarket.getAddress());
    await mockMarket.transferERC721(erc721, u1.address, u0.address, 2);
    expect(await erc721.ownerOf(2)).to.equal(u0.address);
    // Transfer to contract
    await mockMarket.transferERC721(erc721, u1.address, await mockMarket.getAddress(), 3);
    expect(await erc721.ownerOf(3)).to.equal(await mockMarket.getAddress());
  });

  it("ERC721C SecurityPolicy LevelThree", async function () {
    const { erc721, mockMarket, customValidator, u0, u1, u2 } = await loadFixture(defaultFixture);
    await erc721.setToCustomValidatorAndSecurityPolicy(customValidator, 3, 1, 0);
    await erc721.mint(u1.address, 1);
    await erc721.mint(u1.address, 2);
    await erc721.mint(u1.address, 3);
    // OTC Transfer
    // OTC Transfer
    await erc721.connect(u1)["safeTransferFrom(address,address,uint256)"](u1.address, u0.address, 1);
    expect(await erc721.ownerOf(1)).to.equal(u0.address);
    // Operator Transfer
    await erc721.connect(u1).setApprovalForAll(await mockMarket.getAddress(), true);
    await expect(mockMarket.transferERC721(erc721, u1.address, u0.address, 2)).to.be.revertedWithCustomError(
      customValidator,
      "CreatorTokenTransferValidator__CallerMustBeWhitelistedOperator"
    );
    await customValidator.addOperatorToWhitelist(1, await mockMarket.getAddress());
    await mockMarket.transferERC721(erc721, u1.address, u0.address, 2);
    expect(await erc721.ownerOf(2)).to.equal(u0.address);
    // Transfer to contract
    expect(erc721.connect(u1).transferFrom(u1.address, await mockMarket.getAddress(), 3)).to.be.revertedWithCustomError(
      customValidator,
      "CreatorTokenTransferValidator__ReceiverMustNotHaveDeployedCode"
    );
    await customValidator.createPermittedContractReceiverAllowlist("test");
    await customValidator.addPermittedContractReceiverToAllowlist(1, await mockMarket.getAddress());
    await erc721.setToCustomSecurityPolicy(3, 1, 1);
    await erc721.connect(u1).transferFrom(u1.address, await mockMarket.getAddress(), 3);
    expect(await erc721.ownerOf(3)).to.equal(await mockMarket.getAddress());
  });

  it("ERC721C SecurityPolicy LevelFour", async function () {
    const { erc721, mockMarket, customValidator, u0, u1 } = await loadFixture(defaultFixture);
    await erc721.setToCustomValidatorAndSecurityPolicy(customValidator, 4, 1, 0);
    await erc721.mint(u1.address, 1);
    await erc721.mint(u1.address, 2);
    // OTC Transfer
    expect(
      erc721.connect(u1)["safeTransferFrom(address,address,uint256)"](u1.address, u0.address, 1)
    ).to.be.revertedWithCustomError(
      customValidator,
      "CreatorTokenTransferValidator__ReceiverProofOfEOASignatureUnverified"
    );
    await customValidator.connect(u0).verifySignature(await u0.signMessage("EOA"));
    await erc721.connect(u1)["safeTransferFrom(address,address,uint256)"](u1.address, u0.address, 1);
    expect(await erc721.ownerOf(1)).to.equal(u0.address);
    // Operator Transfer
    await erc721.connect(u1).setApprovalForAll(await mockMarket.getAddress(), true);
    await expect(mockMarket.transferERC721(erc721, u1.address, u0.address, 2)).to.be.revertedWithCustomError(
      customValidator,
      "CreatorTokenTransferValidator__CallerMustBeWhitelistedOperator"
    );
    await customValidator.addOperatorToWhitelist(1, await mockMarket.getAddress());
    await mockMarket.transferERC721(erc721, u1.address, u0.address, 2);
    expect(await erc721.ownerOf(2)).to.equal(u0.address);
  });

  it("ERC721C SecurityPolicy LevelFive", async function () {
    const { erc721, mockMarket, customValidator, u0, u1 } = await loadFixture(defaultFixture);
    await erc721.setToCustomValidatorAndSecurityPolicy(customValidator, 4, 1, 0);
    await erc721.mint(u1.address, 1);
    await erc721.mint(u1.address, 2);
    // OTC Transfer
    expect(
      erc721.connect(u1)["safeTransferFrom(address,address,uint256)"](u1.address, u0.address, 1)
    ).to.be.revertedWith("CreatorTokenTransferValidator__ReceiverProofOfEOASignatureUnverified");
    await customValidator.connect(u0).verifySignature(await u0.signMessage("EOA"));
    await erc721.connect(u1)["safeTransferFrom(address,address,uint256)"](u1.address, u0.address, 1);
    expect(await erc721.ownerOf(1)).to.equal(u0.address);
    // Operator Transfer
    await erc721.connect(u1).setApprovalForAll(await mockMarket.getAddress(), true);
    await expect(mockMarket.transferERC721(erc721, u1.address, u0.address, 2)).to.be.revertedWithCustomError(
      customValidator,
      "CreatorTokenTransferValidator__CallerMustBeWhitelistedOperator"
    );
    await customValidator.addOperatorToWhitelist(1, await mockMarket.getAddress());
    await mockMarket.transferERC721(erc721, u1.address, u0.address, 2);
    expect(await erc721.ownerOf(2)).to.equal(u0.address);
  });

  it("ERC721C SecurityPolicy LevelSix", async function () {
    const { erc721, mockMarket, customValidator, u0, u1 } = await loadFixture(defaultFixture);
    await erc721.setToCustomValidatorAndSecurityPolicy(customValidator, 6, 1, 0);
    await erc721.mint(u1.address, 1);
    await erc721.mint(u1.address, 2);
    // OTC Transfer
    expect(
      erc721.connect(u1)["safeTransferFrom(address,address,uint256)"](u1.address, u0.address, 1)
    ).to.be.revertedWithCustomError(
      customValidator,
      "CreatorTokenTransferValidator__ReceiverProofOfEOASignatureUnverified"
    );
    await customValidator.connect(u0).verifySignature(await u0.signMessage("EOA"));
    expect(
      erc721.connect(u1)["safeTransferFrom(address,address,uint256)"](u1.address, u0.address, 1)
    ).to.be.revertedWithCustomError(customValidator, "CreatorTokenTransferValidator__CallerMustBeWhitelistedOperator");
    // Operator Transfer
    await erc721.connect(u1).setApprovalForAll(await mockMarket.getAddress(), true);
    await expect(mockMarket.transferERC721(erc721, u1.address, u0.address, 2)).to.be.revertedWithCustomError(
      customValidator,
      "CreatorTokenTransferValidator__CallerMustBeWhitelistedOperator"
    );
    await customValidator.addOperatorToWhitelist(1, await mockMarket.getAddress());
    await mockMarket.transferERC721(erc721, u1.address, u0.address, 2);
    expect(await erc721.ownerOf(2)).to.equal(u0.address);
  });
});
