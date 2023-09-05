import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { nftTestFixture } from "../common_fixtures";

describe("Test BasicERC721CWithImmutableMinterRoyalties Contract", function () {
  const tokenName = "TestERC721";
  const tokenSymbol = "TE721";
  const baseURI = "https://api.test/meta/goerli";
  const royaltyFeeNumerator = 100;
  const royaltyFeeDenominator = 10000;

  async function defaultFixture() {
    const base = await nftTestFixture();
    const [, , u1] = await hre.ethers.getSigners();

    const Contract = await hre.ethers.getContractFactory("BasicERC721CWithImmutableMinterRoyalties");
    const erc721 = await Contract.deploy(
      tokenName,
      tokenSymbol,
      baseURI,
      base.gateway,
      base.forwarder,
      royaltyFeeNumerator
    );
    await erc721.waitForDeployment();

    return { ...base, erc721, u1 };
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
    const [receiver, royalty] = await erc721.royaltyInfo(1, 10000);
    expect(receiver).to.equal(hre.ethers.ZeroAddress);
    expect(royalty).to.equal((10000 * royaltyFeeNumerator) / royaltyFeeDenominator);
  });

  it("Minter royalties", async function () {
    const { erc721, u1 } = await loadFixture(defaultFixture);
    await erc721.mint(u1.address, 1);
    const [receiver, royalty] = await erc721.royaltyInfo(1, 10000);
    expect(receiver).to.equal(u1.address);
    expect(royalty).to.equal((10000 * royaltyFeeNumerator) / royaltyFeeDenominator);
    await erc721.connect(u1).burn(1);
    const [receiver2, royalty2] = await erc721.royaltyInfo(1, 10000);
    expect(receiver2).to.equal(hre.ethers.ZeroAddress);
    expect(royalty2).to.equal((10000 * royaltyFeeNumerator) / royaltyFeeDenominator);
  });
});
