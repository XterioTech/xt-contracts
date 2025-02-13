
import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployWhitelistClaimETHWithUnlockTime } from "../../lib/deploy";
import MerkleTree from "merkletreejs";
import keccak256 from "keccak256";

describe("WhitelistClaimETHWithUnlockTime", function () {
  async function basicFixture() {
    const [owner, u1, u2, u3, u4] = await hre.ethers.getSigners();
    const whitelist = [u1.address, u2.address, u3.address, u4.address];
    const amounts = [ethers.parseEther("1"), ethers.parseEther("2"), ethers.parseEther("3"), ethers.parseEther("4")]; // Replace with actual amounts
    const startTime = (await time.latest()) - 3600;
    const deadline = (await time.latest()) + 3600; // Set deadline to one hour from now
    const unlockTimes = [startTime, startTime, startTime, deadline];

    const leafNodes = whitelist.map((addr, index) => ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [addr, amounts[index], unlockTimes[index]]
    ));
    const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
    const merkleRoot = merkleTree.getHexRoot();

    const wc = await deployWhitelistClaimETHWithUnlockTime(merkleRoot, startTime, deadline);

    const amount = hre.ethers.parseEther("50");
    await owner.sendTransaction({
      to: await wc.getAddress(),
      value: amount,
    });

    return {
      wc,
      owner,
      u1,
      u2,
      u3,
      u4,
      merkleRoot,
      deadline,
      merkleTree,
      amounts,
      unlockTimes
    };
  }

  it("Should set the correct merkleRoot and deadline", async function () {
    const { wc, merkleRoot, deadline } = await loadFixture(basicFixture);
    expect(await wc.merkleRoot()).to.equal(merkleRoot);
    expect(await wc.deadline()).to.equal(deadline);
  });

  it("Should allow whitelisted address to claim", async function () {
    const { wc, u1, u2, merkleTree, amounts, merkleRoot, unlockTimes } = await loadFixture(basicFixture);
    const leaf = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [u1.address, amounts[0], unlockTimes[0]]
    )
    const proof = merkleTree.getHexProof(leaf);
    const initialBalance = await hre.ethers.provider.getBalance(u1.address);
    const isWhitelisted = await wc.connect(u1).isWhitelisted(u1.address, amounts[0], unlockTimes[0], proof);
    expect(isWhitelisted).to.equal(true);
    const tx = await wc.connect(u1).claim(amounts[0], unlockTimes[0], proof);
    const receipt = await tx.wait();
    const finalBalance = await hre.ethers.provider.getBalance(u1.address);
    expect((finalBalance - initialBalance) + BigInt((receipt?.gasUsed ?? 0)) * BigInt((receipt?.gasPrice ?? 0))).to.equal(amounts[0]);
  });

  it("Should not allow non-whitelisted address to claim", async function () {
    const { wc, u1, u2, merkleTree, amounts, unlockTimes } = await loadFixture(basicFixture);
    const leaf = keccak256(u2.address + amounts[1].toString() + unlockTimes[1].toString());
    const proof = merkleTree.getHexProof(leaf);
    await expect(wc.connect(u1).claim(amounts[1], unlockTimes[1], proof)).to.be.revertedWith("WhitelistClaim: not whitelisted");
  });

  it("Should allow admin to withdraw after deadline", async function () {
    const { wc, owner, amounts } = await loadFixture(basicFixture);
    await time.increase(3601); // Increase time beyond deadline
    await expect(wc.connect(owner).withdraw(owner.address)).to.not.be.reverted;
  });

  it("Should not claim when the unlockTime has not arrived yet", async function () {
    const { wc, u4, merkleTree, amounts, merkleRoot, unlockTimes } = await loadFixture(basicFixture);
    const leaf = ethers.solidityPackedKeccak256(
      ["address", "uint256", "uint256"],
      [u4.address, amounts[3], unlockTimes[3]]
    )
    const proof = merkleTree.getHexProof(leaf);
    const initialBalance = await hre.ethers.provider.getBalance(u4.address);
    const isWhitelisted = await wc.connect(u4).isWhitelisted(u4.address, amounts[3], unlockTimes[3], proof);
    expect(isWhitelisted).to.equal(true);
    await expect(wc.connect(u4).claim(amounts[3], unlockTimes[3], proof)).to.be.rejectedWith("WhitelistClaim: unlockTime has not arrived yet");
  });
});
