import hre from "hardhat";
import { expect } from "chai";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { commonERC721estFixture, commonTradingTestFixture } from "../../common_fixtures";
import { PrizeClaimer } from "../../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployExternalERC1155, deployExternalERC721, deployInvitationFund, deployScoreNFT } from "../../../lib/deploy-aod";


async function defaultFixture() {
  const [admin, signer, u0, u1, u2, u3, u4, u5] = await hre.ethers.getSigners();
  const base = await commonTradingTestFixture();
  const { gateway, gatewayAdmin, manager, erc1155: Coupon, erc721: DINO, erc20: DAM } = base

  const { e721: mechPal } = await deployExternalERC721("name-721", "symbol-721", "baseURI-721", admin.address)
  const mechPalAddress = await mechPal.getAddress()

  const { e1155: dinoSkiPass } = await deployExternalERC1155('baseURI-1155')
  const dinoSkiPassAddress = await dinoSkiPass.getAddress()

  const tokenName = "ScoreNFT";
  const tokenSymbol = "ScoreNFT";
  const baseURI = "https://mc643x6sj1.execute-api.ap-southeast-1.amazonaws.com/v1/dinojump/img"
  const { scoreNFT } = await deployScoreNFT(
    tokenName,
    tokenSymbol,
    baseURI,
    admin.address,
    signer.address,
    mechPalAddress,
    dinoSkiPassAddress
  );

  const invitationFund = await deployInvitationFund(gateway, await scoreNFT.getAddress(), await DAM.getAddress());
  // Add invitationFund to the whitelist
  await gateway
    .connect(gatewayAdmin)
    .addOperatorWhitelist(invitationFund);

  return { base, invitationFund, admin, signer, scoreNFT, DAM, u0, u1, u2, u3, u4, u5 };
}

describe("Test InvitationFund Contract", function () {
  it("should pass Type1 test", async function () {
    // const { base, admin, signer, u0, u1, u2, prizeClaimer, scoreNFT } = await loadFixture(defaultFixture);
    // const { gateway, gatewayAdmin, manager, erc1155: Coupon, erc721: DINO, erc20: DAM } = base

    // this.timeout(30 * 1000);
    // const startTime = 1999888777;
    // const deadline = startTime + 15 * 60;

    // // 1. Manager mints some scoreNFT tokens to u1 as the prizeClaimer tokens
    // await gateway.connect(manager).ERC721_mint(await scoreNFT.getAddress(), u1.address, 0);
    // await gateway.connect(manager).ERC721_mint(await scoreNFT.getAddress(), u1.address, 0);

    // // 2. Reset timestamp
    // time.setNextBlockTimestamp(startTime);

    // const _prizeTypeIdx = 0   //Type1 = ERC721, 1 * Dinosaur NFT
    // const _scoreNFTAddress = await scoreNFT.getAddress()
    // const _scoreNFTTokenIdOne = 1
    // const _prizeTokenAddress = await DINO.getAddress()
    // const _prizeTokenId = 0
    // const _prizeTokenAmount = 1
    // await constructAndClaim(prizeClaimer, signer, u1, _prizeTypeIdx, _scoreNFTAddress, _scoreNFTTokenIdOne, _prizeTokenAddress, _prizeTokenId, _prizeTokenAmount, deadline)
    // await expect(constructAndClaim(prizeClaimer, signer, u1, _prizeTypeIdx, _scoreNFTAddress, _scoreNFTTokenIdOne, _prizeTokenAddress, _prizeTokenId, _prizeTokenAmount, deadline)).to.be.revertedWith("PrizeClaimer: not qualified scoreNFT HODL to claim or this tokenid has been claimed")

    // const _scoreNFTTokenIdTwo = 2
    // await expect(constructAndClaim(prizeClaimer, signer, u2, _prizeTypeIdx, _scoreNFTAddress, _scoreNFTTokenIdTwo, _prizeTokenAddress, _prizeTokenId, _prizeTokenAmount, deadline)).to.be.revertedWith("PrizeClaimer: not qualified scoreNFT HODL to claim or this tokenid has been claimed")


    // /******************** After Claiming ********************/
    // expect(await DINO.ownerOf(1)).to.equal(u1.address);
  });
});
