import hre from "hardhat";
import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ScoreNFT } from "../../../typechain-types";
import { deployExternalERC1155, deployExternalERC721, deployScoreNFT } from "../../../lib/deploy-aod";

async function constructAndMintScoreNFT(
  scoreNFT: ScoreNFT,
  signer: HardhatEthersSigner,
  recipient: HardhatEthersSigner,
  _modelIdx: number,
  _rarityIdx: number,
  _score: number,
  _deadline: number,
  msgValue?: number | string
) {
  // backend signer prepares the signature
  const msgHash = ethers.solidityPackedKeccak256(
    [
      "address", // recipient
      "uint8",  // _modelIdx,
      "uint8",  // _rarityIdx,
      "uint256", // _score
      "uint256", // _deadline
      "uint256", // chainid
    ],
    [
      recipient.address,
      _modelIdx,
      _rarityIdx,
      _score,
      _deadline,
      hre.network.config.chainId,
    ]
  );

  const _sig = await signer.signMessage(hre.ethers.getBytes(msgHash));

  return await scoreNFT.connect(recipient).mintScoreNFT(_modelIdx, _rarityIdx, _score, _deadline, _sig, {
    value: msgValue ?? 0,
  })
}

describe("Test ScoreNFT Contract", async function () {

  const tokenName = "ScoreNFT";
  const tokenSymbol = "ScoreNFT";
  const baseURI = "https://mc643x6sj1.execute-api.ap-southeast-1.amazonaws.com/v1/dinojump/img"

  // ToDo... use real 721 test
  // const mechPalAddress = "0x70e5901AB4119A9B9c9bD4cF02540f5cf80e63cF"

  // 获取当前区块的时间戳
  const startTime = 2000000000

  async function defaultFixture() {
    // Reset timestamp
    await hre.network.provider.send("evm_setNextBlockTimestamp", [startTime]);

    const [admin, signer, u0, u1, u2, u3, u4, u5] = await hre.ethers.getSigners();

    const { e721: mechPal } = await deployExternalERC721("name-721", "symbol-721", "baseURI-721", admin.address)
    const mechPalAddress = await mechPal.getAddress()
    const { e1155: rareTicket } = await deployExternalERC1155('baseURI-1155')
    const rareTicketAddress = await rareTicket.getAddress()

    const { scoreNFT } = await deployScoreNFT(
      tokenName,
      tokenSymbol,
      baseURI,
      admin.address,
      signer.address,
      mechPalAddress,
      rareTicketAddress
    );
    return { scoreNFT, admin, signer, u0, u1, u2, u3, u4, u5, mechPal, rareTicket };
  }

  it("Basic information", async function () {
    const { scoreNFT } = await loadFixture(defaultFixture);
    expect(await scoreNFT.name()).to.equal(tokenName);
    expect(await scoreNFT.symbol()).to.equal(tokenSymbol);
  });

  it("Mint Common NFT", async function () {
    const { scoreNFT, admin, signer, u0, u1, u2, u3, u4, u5 } = await loadFixture(defaultFixture);

    const _modelIdx = 0;
    const _rarityIdx = 0;
    const _score = 300;
    const _deadline = startTime + 15 * 60;

    await constructAndMintScoreNFT(scoreNFT, signer, u1, _modelIdx, _rarityIdx, _score, _deadline)

    expect(await scoreNFT.balanceOf(u1.address)).to.equal(1);
    const nft721Attr = await scoreNFT.nftAttributes(1)
    expect(nft721Attr.score).to.equal(_score);
    expect(await scoreNFT.modelToString(nft721Attr.model)).to.equal("Dino");
    expect(await scoreNFT.rarityToString(nft721Attr.rarity)).to.equal("Common");
    // console.log(await scoreNFT.tokenURI(1))
  });

  it("Mint Rare NFT", async function () {
    const { scoreNFT, admin, signer, u0, u1, u2, u3, u4, u5 } = await loadFixture(defaultFixture);

    const _modelIdx = 1;
    const _rarityIdx = 1;
    const _score = 1000;
    const _deadline = startTime + 15 * 60;

    await constructAndMintScoreNFT(scoreNFT, signer, u1, _modelIdx, _rarityIdx, _score, _deadline, 0.001 * 10 ** 18)

    expect(await scoreNFT.balanceOf(u1.address)).to.equal(1);

    const nft721Attr = await scoreNFT.nftAttributes(1)
    expect(nft721Attr.score).to.equal(_score);
    expect(await scoreNFT.modelToString(nft721Attr.model)).to.equal("MechPal");
    expect(await scoreNFT.rarityToString(nft721Attr.rarity)).to.equal("Rare");
  });

  it("Mint Rare NFT with Mechpal", async function () {
    const { scoreNFT, admin, signer, u0, u1, u2, u3, u4, u5, mechPal } = await loadFixture(defaultFixture);

    await mechPal.connect(u1).mintTo(u1.address)
    await mechPal.connect(u1).setApprovalForAll(await scoreNFT.getAddress(), true)

    const _modelIdx = 1;
    const _rarityIdx = 1;
    const _score = 1000;
    const _deadline = startTime + 15 * 60;

    await constructAndMintScoreNFT(scoreNFT, signer, u1, _modelIdx, _rarityIdx, _score, _deadline, 0)
    expect(await scoreNFT.balanceOf(u1.address)).to.equal(1);

    const nft721Attr = await scoreNFT.nftAttributes(1)
    expect(nft721Attr.score).to.equal(_score);
    expect(await scoreNFT.modelToString(nft721Attr.model)).to.equal("MechPal");
    expect(await scoreNFT.rarityToString(nft721Attr.rarity)).to.equal("Rare");
  });

  it("Mint Rare NFT with Rare-Ticket", async function () {
    const { scoreNFT, admin, signer, u0, u1, u2, u3, u4, u5, rareTicket } = await loadFixture(defaultFixture);

    await rareTicket.connect(u1).mint(u1.address, 1, 1)
    await rareTicket.connect(u1).setApprovalForAll(await scoreNFT.getAddress(), true)

    const _modelIdx = 1;
    const _rarityIdx = 1;
    const _score = 1000;
    const _deadline = startTime + 15 * 60;

    await constructAndMintScoreNFT(scoreNFT, signer, u1, _modelIdx, _rarityIdx, _score, _deadline, 0)
    expect(await scoreNFT.balanceOf(u1.address)).to.equal(1);

    const nft721Attr = await scoreNFT.nftAttributes(1)
    expect(nft721Attr.score).to.equal(_score);
    expect(await scoreNFT.modelToString(nft721Attr.model)).to.equal("MechPal");
    expect(await scoreNFT.rarityToString(nft721Attr.rarity)).to.equal("Rare");

    // Consumed 1 ricket, remian 0
    expect(await rareTicket.balanceOf(u1.address, 1)).to.equal(0)
  });

  it("should pass Withdraw test", async function () {
    // u1 mint 1 rare scorendt with 0.001 ETH
    const { scoreNFT, admin, signer, u0, u1, u2, u3, u4, u5 } = await loadFixture(defaultFixture);
    const _modelIdx = 1;
    const _rarityIdx = 1;
    const _score = 1000;
    const _deadline = startTime + 15 * 60;

    const msgValue = hre.ethers.parseEther("0.001");

    await constructAndMintScoreNFT(scoreNFT, signer, u1, _modelIdx, _rarityIdx, _score, _deadline, msgValue.toString())

    expect(await scoreNFT.balanceOf(u1.address)).to.equal(1);

    const scoreNFTAddress = await scoreNFT.getAddress();

    expect(await hre.ethers.provider.getBalance(scoreNFTAddress)).to.equal(msgValue);
    const beforeValue = await hre.ethers.provider.getBalance(signer)
    await scoreNFT.connect(admin).withdrawTo(signer)
    const afterValue = await hre.ethers.provider.getBalance(signer)
    expect(beforeValue + msgValue).to.equal(afterValue);
    expect(await hre.ethers.provider.getBalance(scoreNFTAddress)).to.equal(0);
  });

  it("should get _mintedTokens test", async function () {
    // u1 mint 1 rare scorendt with 0.001 ETH
    const { scoreNFT, admin, signer, u0, u1, u2, u3, u4, u5 } = await loadFixture(defaultFixture);
    const _modelIdx = 1;
    const _rarityIdx = 1;
    const _score = 1000;
    const _deadline = startTime + 15 * 60;

    const msgValue = hre.ethers.parseEther("0.001");
    await constructAndMintScoreNFT(scoreNFT, signer, u1, _modelIdx, _rarityIdx, _score, _deadline, msgValue.toString())

    const _modelIdx2 = 0;
    const _rarityIdx2 = 1;
    const _score2 = 2000;

    const _modelIdx3 = 0;
    const _rarityIdx3 = 0;
    const _score3 = 1000;

    await constructAndMintScoreNFT(scoreNFT, signer, u1, _modelIdx2, _rarityIdx2, _score2, _deadline, msgValue.toString())
    await constructAndMintScoreNFT(scoreNFT, signer, u1, _modelIdx3, _rarityIdx3, _score3, _deadline, 0)

    expect(await scoreNFT.getMintedTokenIds(u1.address)).to.deep.equal(["1", "2", "3"].map(BigInt))

    // console.log(await scoreNFT.getMintedTokenDetails(u1.address))
  });
});
