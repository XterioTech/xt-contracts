import hre from "hardhat";
import { expect } from "chai";
import { deployForwarder, deployGateway } from "../../lib/deploy";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("Test TokenGateway Contract", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function defaultFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, manager, u1, u2] = await hre.ethers.getSigners();
    const gateway = await deployGateway(owner.address);
    const forwarder = await deployForwarder();
    await gateway.connect(owner).addManager(manager.address);

    return { gateway, forwarder, owner, manager, u1, u2 };
  }

  it("Gateway admin role transfer", async function () {
    const { gateway, owner, u1, u2 } = await loadFixture(defaultFixture);
    // Cannot add by non-admin address
    await expect(gateway.connect(u1).addManager(u2.address)).to.be.reverted;
    // Add u2 as manager
    await gateway.connect(owner).addManager(u2.address);
    // Cannot remove by non-admin address
    await expect(gateway.connect(u1).removeManager(u2.address)).to.be.reverted;
    // Transfer the ownership to u1
    await gateway.connect(owner).transferGatewayOwnership(u1.address);
    // u1 remove u2 from managers
    await gateway.connect(u1).removeManager(u2.address);
    // owner should not be able to add a gateway manager any more
    await expect(gateway.connect(owner).addManager(u2.address)).to.be.reverted;
    // newGatewayAdmin adds a gateway manager
    await gateway.connect(u1).addManager(u2.address);
  });

  it("Gateway operator whitelist", async function () {
    const { gateway, forwarder, owner, u1, u2 } = await loadFixture(defaultFixture);
    // Cannot add by non-admin address
    await expect(gateway.connect(u1).addOperatorWhitelist(forwarder)).to.be.reverted;
    // Cannot add EOA address
    await expect(gateway.connect(owner).addOperatorWhitelist(u2.address)).to.be.revertedWith(
      "TokenGateway: operator is not contract"
    );
    // Add a contract address
    await gateway.connect(owner).addOperatorWhitelist(forwarder);
    // Cannot remove by non-admin address
    await expect(gateway.connect(u1).removeOperatorWhitelist(forwarder)).to.be.reverted;
    await expect(gateway.connect(owner).removeOperatorWhitelist(forwarder)).to.emit(gateway, "RemoveOperatorWhitelist");
  });

  it("ERC721 gateway operations", async function () {
    const { gateway, forwarder, owner, manager, u1, u2 } = await loadFixture(defaultFixture);
    const tokenName = "TestERC721";
    const tokenSymbol = "TE721";
    const baseURI = "https://api.test/meta/goerli";
    const BasicERC721C = await hre.ethers.getContractFactory("BasicERC721C");
    const erc721 = await BasicERC721C.connect(u1).deploy(tokenName, tokenSymbol, baseURI, gateway, forwarder, 10000);
    await erc721.waitForDeployment();

    /***************** Basic Checks ****************/
    expect(await erc721.gateway()).to.equal(await gateway.getAddress());
    expect((await erc721.tokenURI(1234)).toLowerCase()).to.equal(
      `${baseURI}/${await erc721.getAddress()}/${hre.ethers.zeroPadValue("0x04d2", 32)}`.toLowerCase()
    );
    await expect(gateway.connect(u2).ERC721_setURI(erc721, "new_uri")).revertedWith(
      "TokenGateway: caller is not manager of the token contract and is not in whitelist"
    );
    await expect(gateway.connect(u2).ERC721_mint(erc721, u1.address, 111)).revertedWith(
      "TokenGateway: caller is not manager of the token contract and is not in whitelist"
    );

    /******************** Tests ********************/
    // owner mints to owner, u3
    await gateway.connect(u1).ERC721_mint(erc721, owner.address, 222);
    await gateway.connect(u1).ERC721_mint(erc721, owner.address, 223);
    await gateway.connect(u1).ERC721_mint(erc721, u1.address, 333);
    await gateway.connect(u1).ERC721_mintBatch(erc721, u2.address, [101, 102, 103]);
    expect(await erc721.ownerOf(222)).to.equal(owner.address);
    expect(await erc721.ownerOf(223)).to.equal(owner.address);
    expect(await erc721.ownerOf(333)).to.equal(u1.address);
    expect(await erc721.ownerOf(101)).to.equal(u2.address);

    //  owner burns from owner
    await erc721.connect(u1).burn(333);
    await expect(erc721.ownerOf(333)).to.be.revertedWith("ERC721: invalid token ID");

    // owner sets uri of erc721
    await gateway.connect(u1).ERC721_setURI(await erc721.getAddress(), "ipfs://abc");
    expect(await erc721.tokenURI(333)).to.equal(
      `ipfs://abc/${await erc721.getAddress()}/0x000000000000000000000000000000000000000000000000000000000000014d`.toLowerCase()
    );
    expect(await erc721.contractURI()).to.equal(`ipfs://abc/${await erc721.getAddress()}`.toLowerCase());

    // reset erc721 owner
    await gateway.connect(manager).resetOwner(erc721, u2.address);
    expect(await erc721.owner()).to.equal(u2.address);
  });

  it("ERC1155 gateway operations", async function () {
    const { gateway, forwarder, owner, manager, u1, u2 } = await loadFixture(defaultFixture);
    const baseURI = "https://api.test/meta/goerli";
    const BasicERC1155C = await hre.ethers.getContractFactory("BasicERC1155C");
    const erc1155 = await BasicERC1155C.connect(u1).deploy(baseURI, gateway, forwarder);
    await erc1155.waitForDeployment();

    /***************** Basic Checks ****************/
    expect(await erc1155.gateway()).to.equal(await gateway.getAddress());
    expect((await erc1155.uri(1234)).toLowerCase()).to.equal(
      `${baseURI}/${await erc1155.getAddress()}/{id}`.toLowerCase()
    );
    await expect(gateway.connect(u2).ERC1155_setURI(erc1155, "new_uri")).revertedWith(
      "TokenGateway: caller is not manager of the token contract and is not in whitelist"
    );
    await expect(gateway.connect(u2).ERC1155_mint(erc1155, u1.address, 111, 1, "0x")).revertedWith(
      "TokenGateway: caller is not manager of the token contract and is not in whitelist"
    );
    await expect(gateway.connect(u2).ERC1155_mintBatch(erc1155, u1.address, [111], [1], "0x")).revertedWith(
      "TokenGateway: caller is not manager of the token contract and is not in whitelist"
    );

    /******************** Tests ********************/
    await gateway.connect(u1).ERC1155_mint(erc1155, u1.address, 123, 2, "0x");
    expect(await erc1155.balanceOf(u1.address, 123)).to.equal(2);
    await gateway.connect(u1).ERC1155_mintBatch(erc1155, u2.address, [101, 102], [1, 2], "0x");
    expect(await erc1155.balanceOf(u2.address, 101)).to.equal(1);
    expect(await erc1155.balanceOf(u2.address, 102)).to.equal(2);

    //  owner burns from owner
    await erc1155.connect(u1).burn(u1.address, 123, 1);
    expect(await erc1155.balanceOf(u1.address, 123)).to.equal(1);

    // owner sets uri of erc1155
    await gateway.connect(u1).ERC1155_setURI(erc1155, "ipfs://abc");
    expect(await erc1155.uri(333)).to.equal(`ipfs://abc/${await erc1155.getAddress()}/{id}`.toLowerCase());
    expect(await erc1155.contractURI()).to.equal(`ipfs://abc/${await erc1155.getAddress()}`.toLowerCase());

    // reset erc721 owner
    await gateway.connect(manager).resetOwner(erc1155, u2.address);
    expect(await erc1155.owner()).to.equal(u2.address);
  });

  it("ERC20 gateway oprations", async function () {
    const { gateway, forwarder, owner, u1 } = await loadFixture(defaultFixture);

    const tokenName = "Test-ERC20";
    const tokenSymbol = "TERC20";
    const decimals = 9;

    const BasicERC20 = await hre.ethers.getContractFactory("BasicERC20");
    const erc20 = await BasicERC20.connect(owner).deploy(tokenName, tokenSymbol, decimals, gateway, forwarder);
    await erc20.waitForDeployment();

    expect(await erc20.gateway()).to.equal(await gateway.getAddress());
    expect(await erc20.decimals()).to.equal(decimals);

    const initialSupply = 100;
    const transferAmount = 50;
    const burnAmount = 20;
    const transferAmountSmall = 1;

    await gateway.connect(owner).ERC20_mint(await erc20.getAddress(), owner.address, initialSupply);

    expect(await erc20.balanceOf(owner.address)).to.equal(initialSupply);

    // owner transfers to u3
    await erc20.connect(owner).transfer(u1.address, transferAmount);
    expect(await erc20.balanceOf(owner.address)).to.equal(initialSupply - transferAmount);
    expect(await erc20.balanceOf(u1.address)).to.equal(transferAmount);

    // owner burns some tokens
    await erc20.connect(owner).burn(burnAmount);
    // owner tries to burn from u3
    await expect(erc20.connect(owner).burnFrom(u1.address, burnAmount)).to.be.revertedWith(
      "ERC20: insufficient allowance"
    );

    // Pause
    await gateway.connect(owner).pause(erc20);
    await expect(erc20.connect(owner).transfer(u1.address, transferAmountSmall)).to.be.revertedWith("Pausable: paused");

    // Unpause
    await gateway.connect(owner).unpause(erc20);
    // owner transfers small amount to u3
    await erc20.connect(owner).transfer(u1.address, transferAmountSmall);
    expect(await erc20.balanceOf(owner.address)).to.equal(
      initialSupply - transferAmount - burnAmount - transferAmountSmall
    );
    expect(await erc20.balanceOf(u1.address)).to.equal(transferAmount + transferAmountSmall);
  });
});
