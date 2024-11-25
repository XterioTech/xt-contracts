// test/project-specific/ai-campaign/AiCampaign.test.ts
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";
import { EventLog } from "ethers";

describe('AiCampaign', () => {
  async function baseFixture() {
    const [owner, user1] = await ethers.getSigners();
    const eventStartTime = await time.latest();

    const AiCampaign = await ethers.getContractFactory("AiCampaign");
    const aiCampaign = await AiCampaign.deploy(eventStartTime);
    return { aiCampaign, owner, user1 };
  }

  describe('claimChatScore', () => {
    it('should allow a user to claim chat score', async () => {
      const { aiCampaign, user1 } = await loadFixture(baseFixture);
      const tx = await aiCampaign.connect(user1).claimChatScore();
      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => (log as EventLog).fragment.name === 'ChatScoreClaimed');
      expect(event).to.exist;
      const [userAddress, timestamp] = (event as EventLog).args;
      expect(userAddress).to.equal(user1.address);
      expect(timestamp).to.be.closeTo(await time.latest(), 5); // 允许5秒的误差
    });
  });

  describe('switchScene', () => {
    it('should allow a user to switch scene', async () => {
      const { aiCampaign, user1 } = await loadFixture(baseFixture);
      const tx = await aiCampaign.connect(user1).switchScene(1);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => (log as EventLog).fragment.name === 'SceneSwitched');
      expect(event).to.exist;
      const [userAddress, sceneId, timestamp] = (event as EventLog).args;
      expect(userAddress).to.equal(user1.address);
      expect(sceneId).to.equal(1);
      expect(timestamp).to.be.closeTo(await time.latest(), 5);
    });

    it('should revert if scene ID is invalid', async () => {
      const { aiCampaign, user1 } = await loadFixture(baseFixture);
      await expect(aiCampaign.connect(user1).switchScene(29)).to.be.revertedWith("AiCampaign: invalid scene ID");
    });

    it('should revert if maximum switches reached for today', async () => {
      const { aiCampaign, user1 } = await loadFixture(baseFixture);
      await aiCampaign.connect(user1).switchScene(1);
      await aiCampaign.connect(user1).switchScene(2);
      await aiCampaign.connect(user1).switchScene(3);
      await expect(aiCampaign.connect(user1).switchScene(4)).to.be.revertedWith("AiCampaign: maximum switches reached for today");
    });
  });

  describe('remainingSwitches', () => {
    it('should return remaining switches', async () => {
      const { aiCampaign, user1 } = await loadFixture(baseFixture);
      await aiCampaign.connect(user1).switchScene(1);
      const remaining = await aiCampaign.connect(user1).remainingSwitches();
      expect(remaining).to.equal(2);
    });
  });

  describe('claimScore', () => {
    it('should allow a user to claim score', async () => {
      const { aiCampaign, user1 } = await loadFixture(baseFixture);
      const tx = await aiCampaign.connect(user1).claimScore();
      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => (log as EventLog).fragment.name === 'ScoreClaimed');
      expect(event).to.exist;
      const [userAddress, timestamp] = (event as EventLog).args;
      expect(userAddress).to.equal(user1.address);
      expect(timestamp).to.be.closeTo(await time.latest(), 5);
    });
  });

  describe('setEventEndTime', () => {
    it('should allow owner to set event end time', async () => {
      const { aiCampaign, owner } = await loadFixture(baseFixture);
      const newEndTime = (await time.latest()) + 3600;
      await aiCampaign.connect(owner).setEventEndTime(newEndTime);
      expect(await aiCampaign.eventEndTime()).to.equal(newEndTime);
    });

    it('should revert if non-owner tries to set event end time', async () => {
      const { aiCampaign, user1 } = await loadFixture(baseFixture);
      const newEndTime = (await time.latest()) + 3600;
      await expect(aiCampaign.connect(user1).setEventEndTime(newEndTime)).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});