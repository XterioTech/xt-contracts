import hre from "hardhat";
import { expect } from "chai";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { commonTradingTestFixture } from "../../common_fixtures";
import { ScoreNFT } from "../../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  deployExternalERC1155,
  deployExternalERC721,
  deployInvitationFund,
  deployScoreNFT,
} from "../../../lib/deploy-aod";
import { constructAndMintScoreNFT } from "./ScoreNFT";
import { formatEther, formatUnits, parseUnits, parseEther } from "ethers";

async function defaultFixture() {
  const [admin, signer, u0, u1, u2, u3, u4, u5] = await hre.ethers.getSigners();
  const base = await commonTradingTestFixture();
  const {
    gateway,
    gatewayAdmin,
    manager,
    erc1155: Coupon,
    erc721: DINO,
    erc20: DAM,
  } = base;

  const { e721: mechPal } = await deployExternalERC721(
    "name-721",
    "symbol-721",
    "baseURI-721",
    admin.address
  );
  const mechPalAddress = await mechPal.getAddress();

  const { e1155: dinoSkiPass } = await deployExternalERC1155("baseURI-1155");
  const dinoSkiPassAddress = await dinoSkiPass.getAddress();

  const tokenName = "ScoreNFT";
  const tokenSymbol = "ScoreNFT";
  const baseURI =
    "https://mc643x6sj1.execute-api.ap-southeast-1.amazonaws.com/v1/dinojump/img";
  const { scoreNFT } = await deployScoreNFT(
    tokenName,
    tokenSymbol,
    baseURI,
    admin.address,
    signer.address,
    mechPalAddress,
    dinoSkiPassAddress
  );

  const invitationFund = await deployInvitationFund(
    gateway,
    await scoreNFT.getAddress(),
    await DAM.getAddress()
  );
  // Add invitationFund to the whitelist
  await gateway.connect(gatewayAdmin).addOperatorWhitelist(invitationFund);

  return {
    base,
    invitationFund,
    admin,
    signer,
    scoreNFT,
    DAM,
    u0,
    u1,
    u2,
    u3,
    u4,
    u5,
  };
}

async function mintScoreNFT(
  scoreNFT: ScoreNFT,
  signer: HardhatEthersSigner,
  recipient: HardhatEthersSigner
) {
  // u0 invite u1, but u1 has minted scorenft before
  const _modelIdx = 1;
  const _rarityIdx = 1;
  const _score = 1000;
  const startTime = await time.latest();
  const _deadline = startTime + 15 * 60;
  await constructAndMintScoreNFT(
    scoreNFT,
    signer,
    recipient,
    _modelIdx,
    _rarityIdx,
    _score,
    _deadline,
    "0.001"
  );
}

describe("Test InvitationFund Contract", function () {
  it("should pass inviter-invitee relationship test", async function () {
    const { admin, signer, u0, u1, u2, u3, u4, u5, invitationFund, scoreNFT } =
      await loadFixture(defaultFixture);
    // u0 invite u1
    await invitationFund.connect(u0).invite(u1.address);
    expect(await invitationFund.inviterOf(u1.address)).to.equal(u0.address);
    expect(await invitationFund.inviteesOf(u0.address)).to.deep.equal([
      u1.address,
    ]);

    // u0 invite u2
    await invitationFund.connect(u0).invite(u2.address);
    expect(await invitationFund.inviterOf(u2.address)).to.equal(u0.address);
    expect(await invitationFund.inviteesOf(u0.address)).to.deep.equal([
      u1.address,
      u2.address,
    ]);

    //  u0 inviteBatch [u3, u4, u5]
    await invitationFund
      .connect(u0)
      .inviteBatch([u3.address, u4.address, u5.address]);
    expect(await invitationFund.inviteesOf(u0.address)).to.deep.equal([
      u1.address,
      u2.address,
      u3.address,
      u4.address,
      u5.address,
    ]);
  });

  it("should pass inviter-invitee relationship bad-case revert test", async function () {
    const { admin, signer, u0, u1, u2, u3, u4, u5, invitationFund, scoreNFT } =
      await loadFixture(defaultFixture);
    // u0 invite u0
    await expect(
      invitationFund.connect(u0).invite(u0.address)
    ).to.be.revertedWith("Cannot invite your self!");

    // u0 invite u1, but u1 has minted scorenft before
    await mintScoreNFT(scoreNFT, signer, u1);

    await expect(
      invitationFund.connect(u0).invite(u1.address)
    ).to.be.revertedWith("The invitee already has minted ScoreNFT!");

    // owner set most have 2 nvitees
    await invitationFund.connect(admin).setMaxInviteesPerAddr(2);
    await expect(
      invitationFund
        .connect(u0)
        .inviteBatch([u3.address, u4.address, u5.address])
    ).to.be.revertedWith("Too many invitees!");
  });

  it.only("should pass inviter getReward test", async function () {
    const {
      admin,
      DAM,
      signer,
      u0,
      u1,
      u2,
      u3,
      u4,
      u5,
      invitationFund,
      scoreNFT,
    } = await loadFixture(defaultFixture);

    // u0 invite u1-u5
    await invitationFund
      .connect(u0)
      .inviteBatch([
        u1.address,
        u2.address,
        u3.address,
        u4.address,
        u5.address,
      ]);

    // u1 mint rare scoreNFT with 0.001BNB x15
    for (let i = 0; i < 15; i++) {
      await mintScoreNFT(scoreNFT, signer, u1);
    }
    /******************** After invitees Mint scoreNFTS ********************/
    const dam_decimal = 18;
    const rewardPercent = 500_000;
    const rewardDenominator = 100;
    const calcRewardU0 = parseInt(
      formatUnits(
        await invitationFund.calcRewardInToken(u0.address),
        dam_decimal
      )
    );
    expect(calcRewardU0).to.equal(
      (rewardPercent / rewardDenominator) * 0.001 * 15
    );

    // 75 DAM
    await invitationFund.connect(u0).getReward();
    expect(await DAM.connect(u0).balanceOf(u0)).to.be.equal(
      parseUnits(calcRewardU0.toString(), dam_decimal)
    );

    // u2 mint rare scoreNFT with 0.001BNB x5
    for (let i = 0; i < 5; i++) {
      await mintScoreNFT(scoreNFT, signer, u2);
    }
    const calcRewardU0Second = parseInt(
      formatUnits(
        await invitationFund.calcRewardInToken(u0.address),
        dam_decimal
      )
    );

    expect(calcRewardU0Second).to.equal(
      (rewardPercent / rewardDenominator) * 0.001 * 5
    );

    await invitationFund.connect(u0).getReward();
    //  75 DAM + 25 DAM
    expect(await DAM.connect(u0).balanceOf(u0)).to.be.equal(
      parseUnits((calcRewardU0 + calcRewardU0Second).toString(), dam_decimal)
    );

    expect(
      parseInt(formatEther(await invitationFund.remainingToken()))
    ).to.be.equal(
      parseInt(formatEther(await invitationFund.maxRewardedTotalToken())) -
        (calcRewardU0 + calcRewardU0Second)
    );
  });
});
