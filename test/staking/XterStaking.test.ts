import hre from "hardhat";
import { expect } from "chai";
import { loadFixture, setBalance, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
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

  it("Should allow 100 users to stake, restake, and unstake", async function () {
    const { xterToken, xterStakingAddress, xterStaking, admin } = await loadFixture(basicFixture);

    const randomUser = async () => {
      const wallet = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
      await setBalance(wallet.address, hre.ethers.parseEther("100"));
      return wallet;
    };

    const userCount = 100;
    const stakeAmounts = Array.from({ length: userCount }, () => hre.ethers.parseEther((Math.random() * 10 + 1).toFixed(2))); // Random stake amounts between 1 and 10
    const durations = Array.from({ length: userCount }, () => Math.floor(Math.random() * 3600) + 3600); // Random durations between 3600 and 7200 seconds
    const newDurations = Array.from({ length: userCount }, () => Math.floor(Math.random() * 3600) + 3600); // New random durations for restaking

    // Create 100 users
    const users = [];
    for (let i = 0; i < userCount; i++) {
      const wallet = await randomUser(); // Create users using randomUser function
      users.push(wallet);
    }

    // Distribute tokens to 100 users
    for (let i = 0; i < userCount; i++) {
      await xterToken.connect(admin).transfer(users[i].address, stakeAmounts[i]); // Distributing random amounts
    }

    // Approve and stake for each user
    for (let i = 0; i < userCount; i++) {
      await xterToken.connect(users[i]).approve(xterStakingAddress, stakeAmounts[i]);
      await xterStaking.connect(users[i]).stake(stakeAmounts[i], durations[i], users[i].address); // Using random duration
      console.log(`User ${i + 1} staked ${stakeAmounts[i].toString()} for ${durations[i]} seconds`); // Print staking log
    }

    const maxDuration = Math.max(...durations);
    await time.increase(maxDuration + 1);

    // Each user restakes and then unstakes
    for (let i = 0; i < userCount; i++) {
      const stake = await xterStaking.stakes(i);
      await xterStaking.connect(users[i]).restake(i, newDurations[i]); // Restaking with new random duration
      console.log(`User ${i + 1} restaked ${stake.amount.toString()} for ${newDurations[i]} seconds`); // Print restaking log
    }

    const maxNewDurations = Math.max(...newDurations);
    await time.increase(maxNewDurations + 1);

    // Each user unstakes
    for (let i = 0; i < userCount; i++) {
      const newStakeId = i + userCount; // Assuming there is a method to get the new stake ID
      await xterStaking.connect(users[i]).unstake(newStakeId); // Unstake using the new stake ID
      const updatedStake = await xterStaking.stakes(newStakeId);
      expect(updatedStake.claimed).to.equal(true); // Verify that the stake has been claimed
      expect(updatedStake.amount).to.equal(stakeAmounts[i]); // Verify the stake amount
      expect(updatedStake.duration).to.equal(newDurations[i]); // Verify the new stake duration
      console.log(`User ${i + 1} unstaked ${updatedStake.amount.toString()}`); // Print unstaking log
    }
  });
  
}); 