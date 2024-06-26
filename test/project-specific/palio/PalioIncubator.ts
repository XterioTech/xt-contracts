import hre from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployPalioIncubator } from "../../../lib/deploy";
import { PalioIncubator } from "../../../typechain-types";
import { nftTradingTestFixture } from "../../common_fixtures";

describe('PalioIncubator', () => {
  async function baseFixture() {
    const base = await nftTradingTestFixture();
    const [, , , admin, payee, u1, u2] = await hre.ethers.getSigners();

    const gatewayAddress = await base.gateway.getAddress();
    const eggAddress = await base.erc721.getAddress();
    const chatNFTAddress = await base.erc1155.getAddress();

    const incubator: PalioIncubator = await deployPalioIncubator(
      gatewayAddress,
      payee.address,
      eggAddress,
      chatNFTAddress,
      await time.latest()
    )

    await base.gateway.connect(base.gatewayAdmin).addOperatorWhitelist(await incubator.getAddress());
    expect(await base.gateway.nftManager(eggAddress)).equal(base.nftManager.address, "nftManager matched");

    return {
      ...base,
      incubator,
      admin,
      payee,
      u1,
      u2,
    };
  }

  describe('claimEgg', () => {
    it('should allow a user to claim an egg', async () => {
      const { incubator, u1 } = await loadFixture(baseFixture);
      await incubator.connect(u1).claimEgg();
      expect(await incubator.eggClaimed(u1.address)).to.be.true;
    });

    it('should not allow a user to claim an egg twice', async () => {
      const { incubator, u1 } = await loadFixture(baseFixture);
      await incubator.connect(u1).claimEgg();
      await expect(incubator.connect(u1).claimEgg()).to.be.revertedWith("PalioIncubator: already claimed");
    });
  });

  describe('claimUtility', () => {
    it('should allow a user to claim a utility', async () => {
      const { incubator, u1 } = await loadFixture(baseFixture);
      await incubator.connect(u1).claimEgg();
      await incubator.connect(u1).claimUtility(1);
      expect(await incubator.claimedUtilitiesToday(u1.address, 1)).to.equal(1);
    });

    it('should not allow a user to claim a utility more than allowed per day', async () => {
      const { incubator, u1 } = await loadFixture(baseFixture);
      await incubator.connect(u1).claimEgg();
      await incubator.connect(u1).claimUtility(1);
      await expect(incubator.connect(u1).claimUtility(1)).to.be.revertedWith("PalioIncubator: utility claim limit exceeded");
      await incubator.connect(u1).claimUtility(2);
      await incubator.connect(u1).claimUtility(3);
    });
  });

  describe('claimedUtilitiesTodayBatch', () => {
    it('should return an array of claimed utilities count for a specific user and utility types for today', async () => {
      const { incubator, u1 } = await loadFixture(baseFixture);
      await incubator.connect(u1).claimEgg();
      await incubator.connect(u1).claimUtility(1);
      await incubator.connect(u1).claimUtility(2);

      const claimedCounts = await incubator.claimedUtilitiesTodayBatch(u1.address, [1, 2]);

      expect(claimedCounts).to.have.lengthOf(2);
      expect(claimedCounts[0]).to.equal(1);
      expect(claimedCounts[1]).to.equal(1);
    });
  });

  describe('checkChapterStatus', () => {
    it('should return the status of Chat NFT claimed and boosted for a specific user in the current chapter', async () => {
      const { incubator, u1 } = await loadFixture(baseFixture);
      await incubator.connect(u1).claimEgg();
      await incubator.connect(u1).claimChatNFT();
      await incubator.connect(u1).boost({ value: hre.ethers.parseEther("0.01") });

      const [chatNFTClaimedStatus, boostedStatus] = await incubator.checkChapterStatus(u1.address);

      expect(chatNFTClaimedStatus).to.be.true;
      expect(boostedStatus).to.be.true;
    });
  });

  describe('claimChatNFT', () => {
    it('should allow a user to claim a Chat NFT', async () => {
      const { incubator, u1 } = await loadFixture(baseFixture);
      await incubator.connect(u1).claimEgg();
      await incubator.connect(u1).claimChatNFT();
      expect(await incubator.chatNFTClaimed(u1.address, 0)).to.be.true;
    });

    it('should not allow a user to claim a Chat NFT twice in the same chapter', async () => {
      const { incubator, u1 } = await loadFixture(baseFixture);
      await incubator.connect(u1).claimEgg();
      await incubator.connect(u1).claimChatNFT();
      await expect(incubator.connect(u1).claimChatNFT()).to.be.revertedWith("PalioIncubator: already claimed in this chapter");
    });


    it('should return an array of chatNFT claim status for a specific user in all chapters', async () => {
      const { incubator, u1 } = await loadFixture(baseFixture);
      await incubator.connect(u1).claimEgg();
      await incubator.connect(u1).claimChatNFT();

      const claimStatus = await incubator.checkChatNFTClaimStatusBatch(u1.address);

      expect(claimStatus).to.have.lengthOf(4);
      expect(claimStatus[0]).to.be.true; // Chapter 0
      expect(claimStatus[1]).to.be.false; // Chapter 1
      expect(claimStatus[2]).to.be.false; // Chapter 2
      expect(claimStatus[3]).to.be.false; // Chapter 3
    });
  });

  describe('boost', () => {
    it('should allow a user to boost', async () => {
      const { incubator, payee, u1 } = await loadFixture(baseFixture);
      await incubator.connect(u1).claimEgg();
      await incubator.connect(u1).boost({ value: hre.ethers.parseEther("0.01") });
      expect(await incubator.boosted(u1.address, 0)).to.be.true;
    });

    it('should not allow a user to boost twice in the same chapter', async () => {
      const { incubator, payee, u1 } = await loadFixture(baseFixture);
      await incubator.connect(u1).claimEgg();
      await incubator.connect(u1).boost({ value: hre.ethers.parseEther("0.01") });
      await expect(incubator.connect(u1).boost({ value: hre.ethers.parseEther("0.01") })).to.be.revertedWith("PalioIncubator: already boosted in this chapter");
    });
  });

  describe('regenerate', () => {
    it('should allow a user to regenerate', async () => {
      const { incubator, payee, u1 } = await loadFixture(baseFixture);
      await incubator.connect(u1).claimEgg();
      await incubator.connect(u1).regenerate({ value: hre.ethers.parseEther("0.01") });
      expect(await incubator.regenerated(u1.address)).to.equal(1);
    });

    it('should not allow a user to regenerate more than the maximum limit', async () => {
      const { incubator, payee, u1 } = await loadFixture(baseFixture);
      await incubator.connect(u1).claimEgg();
      await incubator.connect(u1).regenerate({ value: hre.ethers.parseEther("0.01") });
      await incubator.connect(u1).regenerate({ value: hre.ethers.parseEther("0.02") });
      await incubator.connect(u1).regenerate({ value: hre.ethers.parseEther("0.03") });
      await expect(incubator.connect(u1).regenerate({ value: hre.ethers.parseEther("0.04") })).to.be.revertedWith("PalioIncubator: regenerate limit exceeded");
    });
  });

});
