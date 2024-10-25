import hre from "hardhat";
import { expect } from "chai";
import { deploySingleCheckIn } from "../../lib/deploy";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("SingleCheckInContract", function () {
  const gameChannel = 1;
  const tgChannel = 2;

  async function basicFixture() {
    const [user1, user2] = await hre.ethers.getSigners();
    const singleCheckIn = await deploySingleCheckIn();

    return { user1, user2, singleCheckIn };
  }

  describe("SingleCheckIn", function () {
    it("SingleCheckIn in game or tg only once per channel", async function () {
      const { user1, user2, singleCheckIn } = await loadFixture(basicFixture);

      const currentBlock = await hre.ethers.provider.getBlock("latest");
      const currentTime = currentBlock?.timestamp || 0;

      await singleCheckIn.connect(user1).checkIn(gameChannel);
      expect(await singleCheckIn.query(await user1.getAddress(), gameChannel)).to.equal(true);

      await expect(singleCheckIn.connect(user1).checkIn(gameChannel)).to.be.revertedWith("Already checked in for this channel.");


      await singleCheckIn.connect(user2).checkIn(tgChannel);
      expect(await singleCheckIn.query(await user2.getAddress(), tgChannel)).to.equal(true);
      await expect(singleCheckIn.connect(user2).checkIn(tgChannel)).to.be.revertedWith("Already checked in for this channel.");

      expect(await singleCheckIn.query(await user1.getAddress(), tgChannel)).to.equal(false);
      expect(await singleCheckIn.query(await user2.getAddress(), gameChannel)).to.equal(false);

      const results = await singleCheckIn.queryMultiUsers([await user1.getAddress(), await user2.getAddress()], gameChannel);
      expect(results[0]).to.equal(true);
      expect(results[1]).to.equal(false);

      const results2 = await singleCheckIn.queryMultiUsers([await user1.getAddress(), await user2.getAddress()], tgChannel);
      expect(results2[0]).to.equal(false);
      expect(results2[1]).to.equal(true);
    });
  });
});