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
      const walletType = 1;
      const tx = await aiCampaign.connect(user1).claimChatScore(walletType);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => (log as EventLog).fragment.name === 'ChatScoreClaimed');
      expect(event).to.exist;
      const [userAddress, returnedWalletType, timestamp] = (event as EventLog).args;
      expect(userAddress).to.equal(user1.address);
      expect(returnedWalletType).to.equal(walletType);
      expect(timestamp).to.be.closeTo(await time.latest(), 5);
    });
  });

  describe('switchScene', () => {
    it('should allow a user to switch scene', async () => {
      const { aiCampaign, user1 } = await loadFixture(baseFixture);
      const walletType = 1;
      const tx = await aiCampaign.connect(user1).switchScene(1, walletType);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => (log as EventLog).fragment.name === 'SceneSwitched');
      expect(event).to.exist;
      const [userAddress, sceneId, returnedWalletType, timestamp] = (event as EventLog).args;
      expect(userAddress).to.equal(user1.address);
      expect(sceneId).to.equal(1);
      expect(returnedWalletType).to.equal(walletType);
      expect(timestamp).to.be.closeTo(await time.latest(), 5);
    });

    it('should revert if scene ID is invalid', async () => {
      const { aiCampaign, user1 } = await loadFixture(baseFixture);
      const walletType = 1;
      await expect(aiCampaign.connect(user1).switchScene(29, walletType)).to.be.revertedWith("AiCampaign: invalid scene ID");
    });
  });

  describe('claimTaskScore', () => {
    it('should allow a user to claim task score', async () => {
      const { aiCampaign, user1 } = await loadFixture(baseFixture);
      const walletType = 1;
      const taskId = 123;
      const tx = await aiCampaign.connect(user1).claimTaskScore(taskId, walletType);
      const receipt = await tx.wait();
      const event = receipt?.logs.find(log => (log as EventLog).fragment.name === 'TaskScoreClaimed');
      expect(event).to.exist;
      const [userAddress, returnedTaskId, returnedWalletType, timestamp] = (event as EventLog).args;
      expect(userAddress).to.equal(user1.address);
      expect(returnedTaskId).to.equal(taskId);
      expect(returnedWalletType).to.equal(walletType);
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