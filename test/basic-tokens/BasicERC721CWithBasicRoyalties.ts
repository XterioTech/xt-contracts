import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { nftTestFixture } from "../common_fixtures";
import { IERC2981InterfaceID, IERC721InterfaceID, getInterfaceID } from "../../lib/utils";
import { IBasicERC721__factory, ICreatorToken__factory } from "../../typechain-types";

describe("Test BasicERC721CWithBasicRoyalties Contract", function () {
  const tokenName = "TestERC721";
  const tokenSymbol = "TE721";
  const baseURI = "https://api.test/meta/goerli";
  const royaltyFeeNumerator = 100;
  const royaltyFeeDenominator = 10000;

  async function defaultFixture() {
    const base = await nftTestFixture();
    const [, , royaltyReceiver, u1] = await hre.ethers.getSigners();

    const Contract = await hre.ethers.getContractFactory("BasicERC721CWithBasicRoyalties");
    const erc721 = await Contract.deploy(
      tokenName,
      tokenSymbol,
      baseURI,
      base.gateway,
      base.forwarder,
      royaltyReceiver.address,
      royaltyFeeNumerator,
      10000
    );
    await erc721.waitForDeployment();

    return { ...base, royaltyReceiver, erc721, u1 };
  }

  it("Basic information", async function () {
    const { erc721, royaltyReceiver } = await loadFixture(defaultFixture);
    const erc721Addr = await erc721.getAddress();
    expect(await erc721.name()).to.equal(tokenName);
    expect(await erc721.symbol()).to.equal(tokenSymbol);
    expect(await erc721.contractURI()).to.equal(`${baseURI}/${erc721Addr}`.toLowerCase());
    expect(await erc721.tokenURI(1)).to.equal(
      `${baseURI}/${erc721Addr}/${hre.ethers.zeroPadValue("0x01", 32)}`.toLowerCase()
    );
    const [receiver, royalty] = await erc721.royaltyInfo(1, 10000);
    expect(receiver).to.equal(royaltyReceiver.address);
    expect(royalty).to.equal((10000 * royaltyFeeNumerator) / royaltyFeeDenominator);
    expect(
      await erc721.supportsInterface(getInterfaceID(IBasicERC721__factory.createInterface())),
      "supportsInterface IBasicERC721"
    ).to.be.true;
    expect(
      await erc721.supportsInterface(getInterfaceID(ICreatorToken__factory.createInterface())),
      "supportsInterface ICreatorToken"
    ).to.be.true;
    expect(await erc721.supportsInterface(IERC721InterfaceID), "supportsInterface IERC721").to.be.true;
    expect(await erc721.supportsInterface(IERC2981InterfaceID), "supportsInterface IERC2981").to.be.true;
  });

  it("Can set default royalty", async function () {
    const { erc721, u1 } = await loadFixture(defaultFixture);
    await expect(erc721.connect(u1).setDefaultRoyalty(u1.address, royaltyFeeNumerator * 2)).revertedWith(
      "GatewayGuardedOwnable: caller is neither the gateway nor the owner"
    );
    await erc721.setDefaultRoyalty(u1.address, royaltyFeeNumerator * 2);
    const [receiver, royalty] = await erc721.royaltyInfo(1, 10000);
    expect(receiver).to.equal(u1.address);
    expect(royalty).to.equal((10000 * royaltyFeeNumerator * 2) / royaltyFeeDenominator);
  });

  it("Can set token royalty", async function () {
    const { erc721, royaltyReceiver, u1 } = await loadFixture(defaultFixture);
    await expect(erc721.connect(u1).setTokenRoyalty(233, u1.address, royaltyFeeNumerator * 2)).revertedWith(
      "GatewayGuardedOwnable: caller is neither the gateway nor the owner"
    );
    await erc721.setTokenRoyalty(233, u1.address, royaltyFeeNumerator * 2);
    const [receiver, royalty] = await erc721.royaltyInfo(1, 10000);
    expect(receiver).to.equal(royaltyReceiver.address);
    expect(royalty).to.equal((10000 * royaltyFeeNumerator) / royaltyFeeDenominator);
    const [receiver2, royalty2] = await erc721.royaltyInfo(233, 10000);
    expect(receiver2).to.equal(u1.address);
    expect(royalty2).to.equal((10000 * royaltyFeeNumerator * 2) / royaltyFeeDenominator);
  });
});
