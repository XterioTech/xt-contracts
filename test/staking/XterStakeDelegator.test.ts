// contracts/test/XterStakeDelegator.test.js
import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployWhitelistClaimERC20, deployMajorToken, deployXterStakeDelegator, deployXterStaking } from "../../lib/deploy";
import MerkleTree from "merkletreejs";
import keccak256 from "keccak256";

describe("XterStakeDelegator", function () {
  async function basicFixture() {
    const [admin, u1, u2, u3] = await hre.ethers.getSigners();
    const whitelist = [u1.address, u2.address, u3.address];
    const amounts = [ethers.parseEther("1"), ethers.parseEther("2"), ethers.parseEther("3")];
    const startTime = (await time.latest()) - 3600;
    const deadline = (await time.latest()) + 3600;

    const xtertToken = await deployMajorToken(admin.address, admin.address);
    const xterTokenAddress = await xtertToken.getAddress()
    const leafNodes = whitelist.map((addr, index) => ethers.solidityPackedKeccak256(
      ["address", "uint256"],
      [addr, amounts[index]]
    ));
    const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
    const merkleRoot = merkleTree.getHexRoot();

    const wc = await deployWhitelistClaimERC20(merkleRoot, startTime, deadline, xterTokenAddress, hre.ethers.ZeroAddress);
    const xterStaking = await deployXterStaking(admin.address, xterTokenAddress);
    const xterStakeDelegator = await deployXterStakeDelegator(await wc.getAddress(), await xterStaking.getAddress());

    await xtertToken.connect(admin).transfer(await wc.getAddress(), ethers.parseEther('1000000'))

    return {
      wc,
      xterStakeDelegator,
      xterStaking,
      admin,
      u1,
      u2,
      u3,
      merkleRoot,
      deadline,
      merkleTree,
      amounts,
      xtertToken,
    };
  }

  it("Should allow user A to delegate claim and stake", async function () {
    const { wc, u1, amounts, merkleTree, xtertToken, xterStaking, xterStakeDelegator } = await loadFixture(basicFixture);
    const leaf = ethers.solidityPackedKeccak256(
      ["address", "uint256"],
      [u1.address, amounts[0]]
    );
    const proof = merkleTree.getHexProof(leaf);
    //   bytes32 hash = keccak256(
    //     abi.encodePacked(
    //         beneficiary,
    //         amount,
    //         proof,
    //         _deadline,
    //         block.chainid,
    //         msg.sender, // delegator
    //         address(this)
    //     )
    // );
    const deadline = (await time.latest()) + 3600
    const msgHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32[]", "uint256", "uint256", "address", "address"],
      [u1.address, amounts[0], proof, deadline, hre.network.config.chainId, await xterStakeDelegator.getAddress(), await wc.getAddress()]
    );

    // 需要 u1 本人签名, 来实现 对 delegate 合约的代理
    const signature = await u1.signMessage(hre.ethers.getBytes(msgHash));
    const initialBalance = await xtertToken.balanceOf(await wc.getAddress());

    //   function claimAndStake(
    //     uint256 totalAmount,
    //     bytes32[] memory proof,
    //     uint256 stakeAmount,
    //     uint256 duration,
    //     uint256 deadline,
    //     bytes calldata sig
    // ) 

    const stakeAmount = ethers.parseEther("0.5")
    const stakeDuration = 1000
    await xterStakeDelegator.connect(u1).claimAndStake(amounts[0], proof, stakeAmount, stakeDuration, deadline, signature);

    const finalBalance = await xtertToken.balanceOf(await wc.getAddress());

    expect(finalBalance).to.equal(initialBalance - amounts[0]);
    expect(await xtertToken.balanceOf(u1.address)).to.equal(amounts[0] - stakeAmount);

    const stakeData = await xterStaking.stakes(0)
    expect(stakeData.claimed).to.equal(false);
    expect(stakeData.amount).to.equal(stakeAmount); // Verify the stake amount
    expect(stakeData.duration).to.equal(stakeDuration); // Verify the stake duration


    await time.increase(stakeDuration + 1);

    await xterStaking.connect(u1).unstake(0);
    const stakeDataAfterUnstake = await xterStaking.stakes(0)

    expect(stakeDataAfterUnstake.claimed).to.equal(true);
    expect(await xtertToken.balanceOf(u1.address)).to.equal(amounts[0]);
  });

  it("Should allow multiple users to delegate claim and stake", async function () {
    const { wc, u1, u2, u3, amounts, merkleTree, xtertToken, xterStaking, xterStakeDelegator } = await loadFixture(basicFixture);

    const users = [u1, u2, u3];
    const stakeAmounts = [ethers.parseEther("0.5"), ethers.parseEther("1"), ethers.parseEther("1.5")];
    const stakeDurations = [1000, 2000, 3000];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const stakeAmount = stakeAmounts[i];
      const stakeDuration = stakeDurations[i];

      const leaf = ethers.solidityPackedKeccak256(
        ["address", "uint256"],
        [user.address, amounts[i]]
      );
      const proof = merkleTree.getHexProof(leaf);
      const deadline = (await time.latest()) + 3600;
      const msgHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32[]", "uint256", "uint256", "address", "address"],
        [user.address, amounts[i], proof, deadline, hre.network.config.chainId, await xterStakeDelegator.getAddress(), await wc.getAddress()]
      );

      const signature = await user.signMessage(hre.ethers.getBytes(msgHash));
      const initialBalance = await xtertToken.balanceOf(await wc.getAddress());

      await xterStakeDelegator.connect(user).claimAndStake(amounts[i], proof, stakeAmount, stakeDuration, deadline, signature);

      const finalBalance = await xtertToken.balanceOf(await wc.getAddress());
      expect(finalBalance).to.equal(initialBalance - amounts[i]);
      expect(await xtertToken.balanceOf(user.address)).to.equal(amounts[i] - stakeAmount);

      const stakeData = await xterStaking.stakes(i); // Assuming stakes are indexed by user
      expect(stakeData.claimed).to.equal(false);
      expect(stakeData.amount).to.equal(stakeAmount);
      expect(stakeData.duration).to.equal(stakeDuration);
    }

    // Calculate the maximum stake duration
    const maxStakeDuration = Math.max(...stakeDurations);
    await time.increase(maxStakeDuration + 1); // Increase the maximum stake duration

    // Verify the stake status of all users
    for (let i = 0; i < users.length; i++) {
      await xterStaking.connect(users[i]).unstake(i); // Assuming stakes are indexed by user

      const stakeDataAfterUnstake = await xterStaking.stakes(i);
      expect(stakeDataAfterUnstake.claimed).to.equal(true);
      expect(await xtertToken.balanceOf(users[i].address)).to.equal(amounts[i]);
    }
  });

  it("Should revert if the signer is not the claimant", async function () {
    const { wc, u1, u2, amounts, merkleTree, xtertToken, xterStaking, xterStakeDelegator } = await loadFixture(basicFixture);

    const leaf = ethers.solidityPackedKeccak256(
      ["address", "uint256"],
      [u1.address, amounts[0]]
    );
    const proof = merkleTree.getHexProof(leaf);
    const deadline = (await time.latest()) + 3600;
    const msgHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32[]", "uint256", "uint256", "address", "address"],
      [u1.address, amounts[0], proof, deadline, hre.network.config.chainId, await xterStakeDelegator.getAddress(), await wc.getAddress()]
    );

    const signature = await u2.signMessage(hre.ethers.getBytes(msgHash)); // u2 signs instead of u1

    await expect(
      xterStakeDelegator.connect(u1).claimAndStake(amounts[0], proof, ethers.parseEther("0.5"), 1000, deadline, signature)
    ).to.be.revertedWith("WhitelistClaim: invalid signature");
  });

  it("Should revert if the signature is expired", async function () {
    const { wc, u1, amounts, merkleTree, xtertToken, xterStaking, xterStakeDelegator } = await loadFixture(basicFixture);

    const leaf = ethers.solidityPackedKeccak256(
      ["address", "uint256"],
      [u1.address, amounts[0]]
    );
    const proof = merkleTree.getHexProof(leaf);
    const deadline = (await time.latest()) - 3600; // Set deadline in the past
    const msgHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32[]", "uint256", "uint256", "address", "address"],
      [u1.address, amounts[0], proof, deadline, hre.network.config.chainId, await xterStakeDelegator.getAddress(), await wc.getAddress()]
    );

    const signature = await u1.signMessage(hre.ethers.getBytes(msgHash));

    await expect(
      xterStakeDelegator.connect(u1).claimAndStake(amounts[0], proof, ethers.parseEther("0.5"), 1000, deadline, signature)
    ).to.be.revertedWith("WhitelistClaim: too late");
  });

  it("Should revert if the amount exceeds the user's claimable amount", async function () {
    const { wc, u1, amounts, merkleTree, xtertToken, xterStaking, xterStakeDelegator } = await loadFixture(basicFixture);

    const leaf = ethers.solidityPackedKeccak256(
      ["address", "uint256"],
      [u1.address, amounts[0]]
    );
    const proof = merkleTree.getHexProof(leaf);
    const deadline = (await time.latest()) + 3600;
    const msgHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32[]", "uint256", "uint256", "address", "address"],
      [u1.address, amounts[0], proof, deadline, hre.network.config.chainId, await xterStakeDelegator.getAddress(), await wc.getAddress()]
    );

    const signature = await u1.signMessage(hre.ethers.getBytes(msgHash));

    await expect(
      xterStakeDelegator.connect(u1).claimAndStake(amounts[0] + ethers.parseEther("1"), proof, ethers.parseEther("0.5"), 1000, deadline, signature) // Exceeding claimable amount
    ).to.be.revertedWith("WhitelistClaim: not whitelisted");
  });

  it("Should revert if the proof is invalid", async function () {
    const { wc, u1, amounts, merkleTree, xtertToken, xterStaking, xterStakeDelegator } = await loadFixture(basicFixture);

    const invalidProof = [hre.ethers.zeroPadValue("0x1234567890abcdef", 32)]; // Invalid proof padded to 32 bytes

    const deadline = (await time.latest()) + 3600;
    const msgHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32[]", "uint256", "uint256", "address", "address"],
      [u1.address, amounts[0], invalidProof, deadline, hre.network.config.chainId, await xterStakeDelegator.getAddress(), await wc.getAddress()]
    );

    const signature = await u1.signMessage(hre.ethers.getBytes(msgHash));

    await expect(
      xterStakeDelegator.connect(u1).claimAndStake(amounts[0], invalidProof, ethers.parseEther("0.5"), 1000, deadline, signature)
    ).to.be.revertedWith("WhitelistClaim: not whitelisted");
  });

  it("Should revert if the user tries to stake more than once", async function () {
    const { wc, u1, amounts, merkleTree, xtertToken, xterStaking, xterStakeDelegator } = await loadFixture(basicFixture);

    const leaf = ethers.solidityPackedKeccak256(
      ["address", "uint256"],
      [u1.address, amounts[0]]
    );
    const proof = merkleTree.getHexProof(leaf);
    const deadline = (await time.latest()) + 3600;
    const msgHash = ethers.solidityPackedKeccak256(
      ["address", "uint256", "bytes32[]", "uint256", "uint256", "address", "address"],
      [u1.address, amounts[0], proof, deadline, hre.network.config.chainId, await xterStakeDelegator.getAddress(), await wc.getAddress()]
    );

    const signature = await u1.signMessage(hre.ethers.getBytes(msgHash));

    // First stake
    await xterStakeDelegator.connect(u1).claimAndStake(amounts[0], proof, ethers.parseEther("0.5"), 1000, deadline, signature);

    // Attempt to stake again
    await expect(
      xterStakeDelegator.connect(u1).claimAndStake(amounts[0], proof, ethers.parseEther("0.5"), 1000, deadline, signature)
    ).to.be.revertedWith("WhitelistClaim: already claimed");
  });
});