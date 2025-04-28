import hre from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployMajorToken, deployLaunchpool } from "../../lib/deploy";

const amount10 = "10000000000000000000"; // 10 个
const amount15 = "15000000000000000000"; // 15 个
const amount50 = "50000000000000000000"; // 50 个
const amount100 = "100000000000000000000"; // 100 个

describe("Launchpool", function () {
    async function basicFixture() {
        const [owner, alice, bob] = await hre.ethers.getSigners();

        const stakingToken = await deployMajorToken(owner.address, owner.address);

        await stakingToken.transfer(alice, amount50);
        await stakingToken.transfer(bob, amount50);

        const rewardsToken = await deployMajorToken(owner.address, owner.address);

        const latestBlock = await hre.ethers.provider.getBlock("latest");

        let startTime = latestBlock?.timestamp || 0;
        startTime += 10; // 10 s 后开始

        const duration = 100; // 100 s
        const rewardAmount = amount100;

        const poolStakeLimit = amount15;
        const userStakeLimit = amount10;

        const launchpool = await deployLaunchpool(owner, stakingToken, rewardsToken, startTime, duration, rewardAmount, poolStakeLimit, userStakeLimit);

        return { owner, alice, bob, stakingToken, rewardsToken, startTime, duration, rewardAmount, poolStakeLimit, userStakeLimit, launchpool };
    }

    it("Should deploy successfully", async function () {
        const { owner, alice, bob, stakingToken, rewardsToken, startTime, duration, rewardAmount, poolStakeLimit, userStakeLimit, launchpool } = await loadFixture(basicFixture);

        expect(await stakingToken.balanceOf(alice)).to.equal(amount50);
        expect(await stakingToken.balanceOf(bob)).to.equal(amount50);
        expect(await rewardsToken.balanceOf(launchpool)).to.equal(0);
        expect(await launchpool.startTime()).to.equal(startTime);
        expect(await launchpool.duration()).to.equal(duration);
        expect(await launchpool.rewardAmount()).to.equal(rewardAmount);
        const rewardRate = BigInt(rewardAmount) / BigInt(duration);
        expect(await launchpool.rewardRate()).to.equal(rewardRate);
        expect(await launchpool.poolStakeLimit()).to.equal(poolStakeLimit);
        expect(await launchpool.userStakeLimit()).to.equal(userStakeLimit);
    });

    it("Should be failed when user stake exceeds user stake limit", async function () {
        const { owner, alice, bob, stakingToken, rewardsToken, startTime, duration, rewardAmount, poolStakeLimit, userStakeLimit, launchpool } = await loadFixture(basicFixture);
        // 活动开始
        await time.increaseTo(startTime);
        await stakingToken.connect(alice).approve(launchpool, amount50);
        await expect(launchpool.connect(alice).stake(amount15)).to.be.revertedWith("Launchpool: exceed user stake limit");
    })

    it("Should be failed when user stake exceeds pool stake limit", async function () {
        const { owner, alice, bob, stakingToken, rewardsToken, startTime, duration, rewardAmount, poolStakeLimit, userStakeLimit, launchpool } = await loadFixture(basicFixture);
        // 活动开始
        await time.increaseTo(startTime);
        await stakingToken.connect(alice).approve(launchpool, amount50);
        await launchpool.connect(alice).stake(amount10);

        await stakingToken.connect(bob).approve(launchpool, amount50);
        await expect(launchpool.connect(bob).stake(amount10)).to.be.revertedWith("Launchpool: exceed pool stake limit");
    })

    it("Should be failed when user withdraws before withdraw time is not yet", async function () {
        const { owner, alice, bob, stakingToken, rewardsToken, startTime, duration, rewardAmount, poolStakeLimit, userStakeLimit, launchpool } = await loadFixture(basicFixture);
        // 活动开始
        await time.increaseTo(startTime);
        await stakingToken.connect(alice).approve(launchpool, amount50);
        await launchpool.connect(alice).stake(amount10);

        await expect(launchpool.connect(alice).withdraw(amount10)).to.be.revertedWith("Launchpool: it's not withdraw time yet");
    })

    it("Should be failed when user gets reward before get reward time is not yet", async function () {
        const { owner, alice, bob, stakingToken, rewardsToken, startTime, duration, rewardAmount, poolStakeLimit, userStakeLimit, launchpool } = await loadFixture(basicFixture);
        // 活动开始
        await time.increaseTo(startTime);
        await stakingToken.connect(alice).approve(launchpool, amount50); // 1
        await launchpool.connect(alice).stake(amount10); // 2
        // 再过 1 s
        await time.increaseTo(BigInt(startTime) + BigInt(3)); // 3 s
        expect(await launchpool.earned(alice)).to.equal("1000000000000000000");
        await expect(launchpool.getReward("1000000000000000000")).to.be.revertedWith("Launchpool: it's not get reward time yet");
    })

    it("Alice stake", async function () {
        const { owner, alice, bob, stakingToken, rewardsToken, startTime, duration, rewardAmount, poolStakeLimit, userStakeLimit, launchpool } = await loadFixture(basicFixture);

        // 首先设置 withdrawTime 为 0
        await launchpool.updateWithdrawTime(0);

        // vault is 0x000
        await rewardsToken.transfer(launchpool.target, rewardAmount);

        expect(await rewardsToken.balanceOf(launchpool)).to.equal(amount100);

        // console.log("startTime: ", startTime)
        // 活动开始
        await time.increaseTo(startTime);
        // let latestBlock = await hre.ethers.provider.getBlock("latest");
        // console.log("活动开始: ", latestBlock?.timestamp);

        // alice 在活动开始后第 3 秒质押了 2 个 token
        await time.increaseTo(BigInt(startTime) + BigInt(1)); // 1 s
        await stakingToken.connect(alice).approve(launchpool, amount50); // 2 s
        await launchpool.connect(alice).stake("2000000000000000000"); // 3 s
        // latestBlock = await hre.ethers.provider.getBlock("latest");
        // console.log("活动开始后第 3 秒: ", latestBlock?.timestamp);

        expect(await launchpool.userStakeAmount(alice)).to.equal("2000000000000000000");
        expect(await stakingToken.balanceOf(launchpool)).to.equal("2000000000000000000");
        expect(await launchpool.totalStakeAmount()).to.equal("2000000000000000000");

        // 过了第 8 秒取出所有 token
        await time.increaseTo(BigInt(startTime) + BigInt(7)); // 7 s
        await launchpool.connect(alice).withdraw("2000000000000000000"); // 8 s
        // latestBlock = await hre.ethers.provider.getBlock("latest");
        // console.log("活动开始后第 8 秒: ", latestBlock?.timestamp);
        // 查询当前的奖励应该是 （2/2） * （8-3） * rewardRate = 5 * 1000000000000000000 = 5 个 reward token
        expect(await launchpool.earned(alice)).to.equal("5000000000000000000");
        expect(await stakingToken.balanceOf(launchpool)).to.equal("0");
        await expect(launchpool.getReward("5000000000000000000")).to.be.revertedWith("Launchpool: it's not get reward time yet");
        await launchpool.updateGetRewardTime(startTime);
        await expect(launchpool.getReward("0")).to.be.revertedWith("Launchpool: can't get reward 0");
        await launchpool.connect(alice).getReward("5000000000000000000");
        expect(await launchpool.earned(alice)).to.equal("0");
        expect(await launchpool.userRewardPaid(alice)).to.equal("5000000000000000000");
        expect(await launchpool.userRewardDebt(alice)).to.equal("0");

        expect(await rewardsToken.balanceOf(alice)).to.equal("5000000000000000000");
        expect(await rewardsToken.balanceOf(launchpool)).to.equal("95000000000000000000");

        // 结束
        await time.increaseTo(BigInt(startTime) + BigInt(101));
        await expect(launchpool.connect(alice).stake("2000000000000000000")).to.be.revertedWith("Launchpool: it's already finished");
    });

    it("Alice and bob stake", async function () {
        const { owner, alice, bob, stakingToken, rewardsToken, startTime, duration, rewardAmount, poolStakeLimit, userStakeLimit, launchpool } = await loadFixture(basicFixture);

        // 首先设置 withdrawTime 为 0
        await launchpool.updateWithdrawTime(0);

        // set vault
        await launchpool.updateVaultAddress(owner.address);
        await rewardsToken.approve(launchpool.target, rewardAmount);

        expect(await rewardsToken.balanceOf(launchpool)).to.equal(0);

        // 活动开始
        await time.increaseTo(startTime);
        // let latestBlock = await hre.ethers.provider.getBlock("latest");
        // console.log("活动开始: ", latestBlock?.timestamp);

        // alice 在活动开始后第 3 秒质押了 2 个 token
        await time.increaseTo(BigInt(startTime) + BigInt(1)); // 1 s
        await stakingToken.connect(alice).approve(launchpool, "2000000000000000000"); // 2 s
        await launchpool.connect(alice).stake("2000000000000000000"); // 3 s
        // latestBlock = await hre.ethers.provider.getBlock("latest");
        // console.log("活动开始后第 3 秒: ", latestBlock?.timestamp);

        // bob 在第 6 秒也质押了 2 个 token
        await time.increaseTo(BigInt(startTime) + BigInt(4)); // 4 s
        await stakingToken.connect(bob).approve(launchpool, "2000000000000000000"); // 5 s
        await launchpool.connect(bob).stake("2000000000000000000"); // 6 s
        // latestBlock = await hre.ethers.provider.getBlock("latest");
        // console.log("活动开始后第 6 秒: ", latestBlock?.timestamp);

        // alice 在第 8 秒解押
        await time.increaseTo(BigInt(startTime) + BigInt(7)); // 7 s
        await launchpool.connect(alice).withdraw("2000000000000000000"); // 8 s

        // bob 在第 10 秒解押
        await time.increaseTo(BigInt(startTime) + BigInt(9)); // 9 s
        await launchpool.connect(bob).withdraw("2000000000000000000"); // 10 s

        await expect(launchpool.getReward("5000000000000000000")).to.be.revertedWith("Launchpool: it's not get reward time yet");
        await launchpool.updateGetRewardTime(startTime);

        expect(await launchpool.earned(alice)).to.equal("4000000000000000000");
        expect(await launchpool.earned(bob)).to.equal("3000000000000000000");
        await launchpool.connect(alice).getReward("4000000000000000000");
        await launchpool.connect(bob).getReward("3000000000000000000");
        expect(await launchpool.earned(alice)).to.equal("0");
        expect(await launchpool.earned(bob)).to.equal("0");
        expect(await launchpool.userRewardPaid(alice)).to.equal("4000000000000000000");
        expect(await launchpool.userRewardPaid(bob)).to.equal("3000000000000000000");
        expect(await launchpool.userRewardDebt(alice)).to.equal("0");
        expect(await launchpool.userRewardDebt(bob)).to.equal("0");

        expect(await rewardsToken.balanceOf(launchpool)).to.equal(0);
    });

    it("Alice stake more", async function () {
        const { owner, alice, bob, stakingToken, rewardsToken, startTime, duration, rewardAmount, poolStakeLimit, userStakeLimit, launchpool } = await loadFixture(basicFixture);

        // 首先设置 withdrawTime 为 0
        await launchpool.updateWithdrawTime(0);

        // vault is 0x000
        await rewardsToken.transfer(launchpool.target, rewardAmount);

        expect(await rewardsToken.balanceOf(launchpool)).to.equal(amount100);

        // console.log("startTime: ", startTime)
        // 活动开始
        await time.increaseTo(startTime);
        // let latestBlock = await hre.ethers.provider.getBlock("latest");
        // console.log("活动开始: ", latestBlock?.timestamp);

        // alice 在活动开始后第 3 秒质押了 2 个 token
        await time.increaseTo(BigInt(startTime) + BigInt(1)); // 1 s
        await stakingToken.connect(alice).approve(launchpool, amount50); // 2 s
        await launchpool.connect(alice).stake("2000000000000000000"); // 3 s
        // latestBlock = await hre.ethers.provider.getBlock("latest");
        // console.log("活动开始后第 3 秒: ", latestBlock?.timestamp);

        expect(await stakingToken.balanceOf(launchpool)).to.equal("2000000000000000000");

        // 过了第 8 秒取出所有 token
        await time.increaseTo(BigInt(startTime) + BigInt(7)); // 7 s
        // latestBlock = await hre.ethers.provider.getBlock("latest");
        // console.log("活动开始后第 8 秒: ", latestBlock?.timestamp);
        await launchpool.connect(alice).withdraw("2000000000000000000"); // 8 s
        // latestBlock = await hre.ethers.provider.getBlock("latest");
        // console.log("活动开始后第 8 秒: ", latestBlock?.timestamp);
        // 查询当前的奖励应该是 （2/2） * （8-3） * rewardRate = 5 * 1000000000000000000 = 5 个 reward token
        expect(await launchpool.earned(alice)).to.equal("5000000000000000000");
        expect(await stakingToken.balanceOf(launchpool)).to.equal("0");
        await expect(launchpool.getReward("5000000000000000000")).to.be.revertedWith("Launchpool: it's not get reward time yet"); // 9s
        await launchpool.updateGetRewardTime(startTime); // 10 s
        await launchpool.connect(alice).getReward("5000000000000000000"); // 11 s
        expect(await launchpool.earned(alice)).to.equal("0");
        expect(await launchpool.userRewardPaid(alice)).to.equal("5000000000000000000");
        expect(await launchpool.userRewardDebt(alice)).to.equal("0");

        expect(await rewardsToken.balanceOf(alice)).to.equal("5000000000000000000");
        expect(await rewardsToken.balanceOf(launchpool)).to.equal("95000000000000000000");

        // 新质押
        await launchpool.connect(alice).stake("2000000000000000000"); // 12 s


        expect(await stakingToken.balanceOf(launchpool)).to.equal("2000000000000000000");

        // 过了第 8 秒取出所有 token
        await time.increaseTo(BigInt(startTime) + BigInt(17)); // 7 s
        // latestBlock = await hre.ethers.provider.getBlock("latest");
        // console.log("活动开始后第 8 秒: ", latestBlock?.timestamp);
        // 查询当前的奖励应该是 （2/2） * （8-3） * rewardRate = 5 * 1000000000000000000 = 5 个 reward token
        expect(await launchpool.earned(alice)).to.equal("5000000000000000000");
        expect(await launchpool.userRewardPaid(alice)).to.equal("5000000000000000000");
        expect(await launchpool.totalReward(alice)).to.equal("10000000000000000000");
        expect(await launchpool.userRewardDebt(alice)).to.equal("0");

        await launchpool.connect(alice).withdraw("2000000000000000000"); // 多一秒

        expect(await stakingToken.balanceOf(launchpool)).to.equal("0");

        expect(await launchpool.earned(alice)).to.equal("6000000000000000000");
        expect(await launchpool.userRewardPaid(alice)).to.equal("5000000000000000000");
        expect(await launchpool.totalReward(alice)).to.equal("11000000000000000000");
        expect(await launchpool.userRewardDebt(alice)).to.equal("6000000000000000000");

        await launchpool.connect(alice).getReward("6000000000000000000");

        expect(await launchpool.earned(alice)).to.equal("0");
        expect(await launchpool.userRewardPaid(alice)).to.equal("11000000000000000000");
        expect(await launchpool.totalReward(alice)).to.equal("11000000000000000000");
        expect(await launchpool.userRewardDebt(alice)).to.equal("0");

        expect(await rewardsToken.balanceOf(alice)).to.equal("11000000000000000000");
        expect(await rewardsToken.balanceOf(launchpool)).to.equal("89000000000000000000");

    });
})