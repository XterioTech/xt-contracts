import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { nftTestFixture, whitelistedOperator } from "../common_fixtures";
import { IBasicERC1155__factory, ICreatorToken__factory } from "../../typechain-types";
import { IERC1155InterfaceID, IERC2981InterfaceID, getInterfaceID } from "../../lib/utils";

describe("Test BasicERC1155C Contract", function () {
  const baseURI = "https://api.test/meta/goerli";
  async function defaultFixture() {
    const base = await nftTestFixture();
    const [, , u0, u1, u2, u3, u4, u5] = await hre.ethers.getSigners();

    const BasicERC1155C = await hre.ethers.getContractFactory("BasicERC1155C");
    const erc1155 = await BasicERC1155C.deploy(baseURI, base.gateway, base.forwarder);
    await erc1155.waitForDeployment();

    return { ...base, erc1155, u0, u1, u2, u3, u4, u5 };
  }

  it("Basic information", async function () {
    const { erc1155 } = await loadFixture(defaultFixture);
    const contractAddr = await erc1155.getAddress();
    expect(await erc1155.contractURI()).to.equal(`${baseURI}/${contractAddr}`.toLowerCase());
    expect(await erc1155.uri(1)).to.equal(`${baseURI}/${contractAddr}/{id}`.toLowerCase());
    await erc1155.setURI("ipfs://abc");
    expect(await erc1155.contractURI()).to.equal(`ipfs://abc/${contractAddr}`.toLowerCase());
    expect(await erc1155.uri(1)).to.equal(`ipfs://abc/${contractAddr}/{id}`.toLowerCase());
    expect(
      await erc1155.supportsInterface(getInterfaceID(IBasicERC1155__factory.createInterface())),
      "supportsInterface IBasicERC1155"
    ).to.be.true;
    expect(
      await erc1155.supportsInterface(getInterfaceID(ICreatorToken__factory.createInterface())),
      "supportsInterface ICreatorToken"
    ).to.be.true;
    expect(await erc1155.supportsInterface(IERC1155InterfaceID), "supportsInterface IERC1155").to.be.true;
    expect(await erc1155.supportsInterface(IERC2981InterfaceID), "supportsInterface IERC2981").to.be.false;
  });

  it("Cannot perform manage operations by normal address", async function () {
    const { erc1155, u0, u1 } = await loadFixture(defaultFixture);
    // u0 cannot mint
    await expect(erc1155.connect(u0).mint(u1.address, 1, 1, "0x")).to.revertedWith(
      "GatewayGuardedOwnable: caller is neither the gateway nor the owner"
    );
    // u0 cannot mint batch
    await expect(erc1155.connect(u0).mintBatch(u1.address, [1, 2], [1, 1], "0x")).to.revertedWith(
      "GatewayGuardedOwnable: caller is neither the gateway nor the owner"
    );
    // u0 cannot set uri
    await expect(erc1155.connect(u0).setURI("https://abc")).to.revertedWith(
      "GatewayGuardedOwnable: caller is neither the gateway nor the owner"
    );
    // u0 cannot pause
    await expect(erc1155.connect(u0).pause()).to.revertedWith(
      "GatewayGuardedOwnable: caller is neither the gateway nor the owner"
    );
    // u0 cannot unpause
    await expect(erc1155.connect(u0).unpause()).to.revertedWith(
      "GatewayGuardedOwnable: caller is neither the gateway nor the owner"
    );
  });

  it("Cannot transfer when paused", async function () {
    const { erc1155, u0, u1 } = await loadFixture(defaultFixture);

    await erc1155.mint(u1.address, 1, 1, "0x");
    await erc1155.pause();
    await expect(erc1155.connect(u1).safeTransferFrom(u1.address, u0.address, 1, 1, "0x")).to.be.revertedWith(
      "Pausable: paused"
    );
    await expect(erc1155.mint(u1.address, 2, 1, "0x")).to.be.revertedWith("Pausable: paused");
    await erc1155.unpause();
    await erc1155.connect(u1).safeTransferFrom(u1.address, u0.address, 1, 1, "0x");
    await erc1155.mint(u1.address, 2, 1, "0x");
  });

  it("erc1155C None Security Policy", async function () {
    const { erc1155, mockMarket, u0, u1 } = await loadFixture(defaultFixture);

    /***************** Default None Security Policy ****************/
    expect(await erc1155.getTransferValidator()).to.equal(hre.ethers.ZeroAddress);
    await erc1155.mintBatch(u1.address, [1, 2], [1, 1], "0x");
    // OTC Transfer
    await erc1155.connect(u1).safeTransferFrom(u1.address, u0.address, 1, 1, "0x");
    expect(await erc1155.balanceOf(u0.address, 1)).to.equal(1);
    // Operator Transfer
    await expect(mockMarket.transferERC1155(erc1155, u1.address, u0.address, 2, 1)).to.be.revertedWith(
      "ERC1155: caller is not token owner or approved"
    );
    await erc1155.connect(u1).setApprovalForAll(mockMarket, true);
    await mockMarket.transferERC1155(erc1155, u1.address, u0.address, 2, 1);
    expect(await erc1155.balanceOf(u0.address, 2)).to.equal(1);
  });

  it("erc1155C SecurityPolicy LevelOne", async function () {
    const { erc1155, mockMarket, customValidator, u0, u1, u2 } = await loadFixture(defaultFixture);
    await erc1155.setToCustomValidatorAndSecurityPolicy(customValidator, 1, 1, 0);
    await erc1155.mint(u1.address, 1, 1, "0x");
    await erc1155.mint(u1.address, 2, 1, "0x");
    await erc1155.mint(u1.address, 3, 1, "0x");
    expect(await erc1155.getTransferValidator()).to.equal(await customValidator.getAddress());
    expect(await erc1155.isOperatorWhitelisted(whitelistedOperator)).to.equal(true);
    expect(await erc1155.isOperatorWhitelisted(mockMarket)).to.equal(false);
    expect(await erc1155.isTransferAllowed(whitelistedOperator, u1.address, u2.address)).to.equal(true);
    expect(await erc1155.isTransferAllowed(mockMarket, u1.address, u2.address)).to.equal(false);
    // OTC Transfer
    await erc1155.connect(u1).safeTransferFrom(u1.address, u0.address, 1, 1, "0x");
    expect(await erc1155.balanceOf(u0.address, 1)).to.equal(1);
    // Operator Transfer
    await erc1155.connect(u1).setApprovalForAll(mockMarket, true);
    await expect(mockMarket.transferERC1155(erc1155, u1.address, u0.address, 2, 1)).to.be.revertedWithCustomError(
      customValidator,
      "CreatorTokenTransferValidator__CallerMustBeWhitelistedOperator"
    );
    await customValidator.addOperatorToWhitelist(1, mockMarket);
    await mockMarket.transferERC1155(erc1155, u1.address, u0.address, 2, 1);
    expect(await erc1155.balanceOf(u0.address, 2)).to.equal(1);
    // Transfer to contract
    await expect(erc1155.connect(u1).safeTransferFrom(u1.address, mockMarket, 3, 1, "0x")).revertedWith(
      "ERC1155: transfer to non-ERC1155Receiver implementer"
    );
  });
});
