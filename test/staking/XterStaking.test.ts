import { Signer } from "ethers";
import hre from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployMajorToken, deployXterStaking } from "../../lib/deploy";

const STAKE_AMOUNT = hre.ethers.parseEther("1");
const DURATION = 3600; // 1 hour

describe("Test XterStaking Contract", function () {
  async function basicFixture() {
    const [admin, user1, user2] = await hre.ethers.getSigners();
    const xterToken = await deployMajorToken(admin.address, admin.address);
    const xterTokenAddress = await xterToken.getAddress();
    const xterStaking = await deployXterStaking(admin.address, xterTokenAddress);
    const xterStakingAddress = await xterStaking.getAddress();

    const amountToDistribute = hre.ethers.parseEther("10");
    await xterToken.connect(admin).transfer(user1.address, amountToDistribute);
    await xterToken.connect(admin).transfer(user2.address, amountToDistribute);

    return {
      xterToken,
      xterTokenAddress,
      xterStaking,
      xterStakingAddress,
      admin,
      user1,
      user2,
    };
  }

  it("Should allow manager to pause and unpause the contract", async function () {
    const { xterStaking, xterStakingAddress, admin, xterToken } = await loadFixture(basicFixture);

    await xterToken.connect(admin).approve(xterStakingAddress, STAKE_AMOUNT);

    await xterStaking.connect(admin).pause();
    await expect(xterStaking.connect(admin).stake(STAKE_AMOUNT, DURATION, admin.address)).to.be.revertedWith("Pausable: paused");

    await xterStaking.connect(admin).unpause();
    await expect(xterStaking.connect(admin).stake(STAKE_AMOUNT, DURATION, admin.address)).to.not.be.reverted;
  });

  it("Should allow user to stake", async function () {
    const { xterToken, xterStakingAddress, xterStaking, user1 } = await loadFixture(basicFixture);

    await xterToken.connect(user1).approve(xterStakingAddress, STAKE_AMOUNT);
    await xterStaking.connect(user1).stake(STAKE_AMOUNT, DURATION, user1.address);

    const stake = await xterStaking.stakes(0);
    expect(stake.amount).to.equal(STAKE_AMOUNT);
    expect(stake.staker).to.equal(user1.address);
    expect(stake.duration).to.equal(DURATION);
    expect(stake.claimed).to.equal(false);
  });

  it("Should allow user to unstake after duration", async function () {
    const { xterToken, xterStakingAddress, xterStaking, user1 } = await loadFixture(basicFixture);

    await xterToken.connect(user1).approve(xterStakingAddress, STAKE_AMOUNT);
    await xterStaking.connect(user1).stake(STAKE_AMOUNT, DURATION, user1.address);

    // Fast forward time
    await time.increase(DURATION + 1);

    await xterStaking.connect(user1).unstake(0);

    const stake = await xterStaking.stakes(0);
    expect(stake.claimed).to.equal(true);
  });

  it("Should not allow user to unstake before duration", async function () {
    const { xterToken, xterStakingAddress, xterStaking, user1 } = await loadFixture(basicFixture);

    await xterToken.connect(user1).approve(xterStakingAddress, STAKE_AMOUNT);
    await xterStaking.connect(user1).stake(STAKE_AMOUNT, DURATION, user1.address);

    await expect(xterStaking.connect(user1).unstake(0)).to.be.revertedWith("Stake period not ended");
  });

  it("Should not allow user to unstake if already claimed", async function () {
    const { xterToken, xterStakingAddress, xterStaking, user1 } = await loadFixture(basicFixture);

    await xterToken.connect(user1).approve(xterStakingAddress, STAKE_AMOUNT);
    await xterStaking.connect(user1).stake(STAKE_AMOUNT, DURATION, user1.address);

    // Fast forward time
    await time.increase(DURATION + 1);
    await xterStaking.connect(user1).unstake(0);

    await expect(xterStaking.connect(user1).unstake(0)).to.be.revertedWith("Stake not valid or already claimed");
  });

  it("Should allow user to restake", async function () {
    const { xterToken, xterStakingAddress, xterStaking, user1 } = await loadFixture(basicFixture);

    await xterToken.connect(user1).approve(xterStakingAddress, STAKE_AMOUNT);
    await xterStaking.connect(user1).stake(STAKE_AMOUNT, DURATION, hre.ethers.ZeroAddress);

    // Fast forward time
    await time.increase(DURATION + 1);
    const newDuration = 7200; // 2 hours
    await xterStaking.connect(user1).restake(0, newDuration);

    const stake = await xterStaking.stakes(1);
    expect(stake.amount).to.equal(STAKE_AMOUNT);
    expect(stake.duration).to.equal(newDuration);
  });
}); 