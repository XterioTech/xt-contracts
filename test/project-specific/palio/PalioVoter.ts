import hre from "hardhat";
import ethers from "ethers";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployPalioVoter } from "../../../lib/deploy";
import { PalioVoter } from "../../../typechain-types";
import { signPalioVoter } from "../../../lib/signature";

const placeVote = async ({
  palioVoter,
  signer,
  voter,
  characterIdx,
  amount,
  totalAmount,
  expire,
}: {
  palioVoter: PalioVoter;
  signer: ethers.Signer;
  voter: ethers.Signer;
  characterIdx: number;
  amount: number;
  totalAmount: number;
  expire?: number;
}) => {
  expire = expire || (await time.latest()) + 500;
  const signature = await signPalioVoter(
    signer,
    await voter.getAddress(),
    characterIdx,
    amount,
    totalAmount,
    expire,
    palioVoter.target
  );
  return palioVoter.connect(voter).vote(characterIdx, amount, totalAmount, expire, signature);
};

describe('PalioVoter', () => {
  async function basicFixture() {
    const eventStartTime = await time.latest();
    const [admin, signer, v1, v2, v3] = await hre.ethers.getSigners();
    const palioVoter = await deployPalioVoter(signer.address, eventStartTime);
    return {
      palioVoter,
      admin,
      signer,
      v1, v2, v3,
      eventStartTime
    };
  }

  describe('vote', () => {
    it('should allow a user to vote for a character', async () => {
      const { palioVoter, signer, v1, eventStartTime } = await loadFixture(basicFixture);
      const characterIdx = 0;
      const amount = 100;
      const totalAmount = 1000;

      await placeVote({ palioVoter, signer, voter: v1, characterIdx, amount, totalAmount });
      const votedAmt = await palioVoter.getVotedAmt(await v1.getAddress());
      expect(votedAmt[characterIdx]).to.equal(amount);
    });

    it('should not allow a user to vote with an expired signature', async () => {
      const { palioVoter, signer, v1, v2, eventStartTime } = await loadFixture(basicFixture);
      const characterIdx = 1;
      const amount = 200;
      const totalAmount = 1000;
      await expect(placeVote({ palioVoter, signer, voter: v1, characterIdx, amount, totalAmount, expire: eventStartTime - 50000 })).to.be.revertedWith('signature expired');
    });

    it('should not allow a user to vote for an eliminated character', async () => {
      const { palioVoter, signer, v1, v2, v3, eventStartTime } = await loadFixture(basicFixture);
      const characterIdx = 1;
      const amount = 300;
      const totalAmount = 1000;

      // 2 weeks after
      await time.setNextBlockTimestamp(eventStartTime + 14 * 24 * 60 * 60);
      await palioVoter.connect(v3).updateEliminatedCharacters(); // Eliminate character 2 (idx 1)
      await expect(placeVote({ palioVoter, signer, voter: v1, characterIdx, amount, totalAmount })).to.be.revertedWith('This character has been eliminated');
    });
  });

  describe('updateEliminatedCharacters', () => {
    it('should eliminate the character with the least votes', async () => {
      const { palioVoter, signer, v1, v2, v3, eventStartTime } = await loadFixture(basicFixture);
      const characterIdx = 1;
      const characterIdx2 = 2;
      const amount = 300;
      const totalAmount = 1000;

      await placeVote({ palioVoter, signer, voter: v1, characterIdx, amount, totalAmount });
      await placeVote({ palioVoter, signer, voter: v2, characterIdx: characterIdx2, amount, totalAmount });


      expect(await palioVoter.getEliminatedCharacters()).to.have.lengthOf(0);

      await time.setNextBlockTimestamp(eventStartTime + 7 * 24 * 60 * 60);

      await placeVote({ palioVoter, signer, voter: v2, characterIdx: characterIdx2, amount, totalAmount, expire: eventStartTime + 7 * 24 * 60 * 60 + 500 });
      expect(await palioVoter.getEliminatedCharacters()).to.have.lengthOf(1);
    });
  });
});
