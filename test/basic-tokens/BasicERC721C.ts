import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { nftTestFixture, whitelistedOperator } from "../common_fixtures";

const nullAddr = "0x0000000000000000000000000000000000000000";

describe("Test BasicERC721C Contract", function () {
  const tokenName = "TestERC721";
  const tokenSymbol = "TE721";
  const baseURI = "https://api.test/meta/goerli";

  async function defaultFixture() {
    const base = await nftTestFixture();
    const [, , u0, u1, u2, u3, u4, u5] = await hre.ethers.getSigners();

    const BasicERC721C = await hre.ethers.getContractFactory("BasicERC721C");
    const erc721 = await BasicERC721C.deploy(tokenName, tokenSymbol, baseURI, base.gateway, base.forwarder);
    await erc721.waitForDeployment();

    return { ...base, erc721, u0, u1, u2, u3, u4, u5 };
  }

  it("Basic information", async function () {
    const { erc721 } = await loadFixture(defaultFixture);
    const erc721Addr = await erc721.getAddress();
    expect(await erc721.name()).to.equal(tokenName);
    expect(await erc721.symbol()).to.equal(tokenSymbol);
    expect(await erc721.contractURI()).to.equal(`${baseURI}/${erc721Addr}`.toLowerCase());
    expect(await erc721.tokenURI(1)).to.equal(
      `${baseURI}/${erc721Addr}/${hre.ethers.zeroPadValue("0x01", 32)}`.toLowerCase()
    );
  });

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
