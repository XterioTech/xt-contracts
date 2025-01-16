import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployXterNFTStaking } from "../../lib/deploy";
import { nftTradingTestFixture } from "../common_fixtures";
import { ERC721, XterNFTStaking } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "ethers";

describe("Test XterNFTStaking Contract", function () {
  async function basicFixture() {
    const [admin, user1, user2] = await hre.ethers.getSigners();

    // Deploy ERC721 tokens for testing
    const { gateway, erc721: erc721One, nftManager } = await nftTradingTestFixture();
    const erc721OneAddress = await erc721One.getAddress();

    const { gateway: gatewayTwo, erc721: erc721Two, nftManager: nftManagerTwo } = await nftTradingTestFixture();
    const erc721TwoAddress = await erc721Two.getAddress();

    await gateway.connect(nftManager).ERC721_mintBatch(erc721One, user1, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    await gateway.connect(nftManager).ERC721_mintBatch(erc721One, user2, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);

    await gatewayTwo.connect(nftManagerTwo).ERC721_mintBatch(erc721Two, user1, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    await gatewayTwo.connect(nftManagerTwo).ERC721_mintBatch(erc721Two, user2, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);

    // Deploy the XterNFTStaking contract
    const xterNFTStaking = await deployXterNFTStaking(admin.address);
    const xterNFTStakingAddress = await xterNFTStaking.getAddress();

    return {
      erc721One,
      erc721OneAddress,
      erc721Two,
      erc721TwoAddress,
      xterNFTStaking,
      xterNFTStakingAddress,
      admin,
      user1,
      user2,
    };
  }

  let xterNFTStaking: XterNFTStaking,
    xterNFTStakingAddress: string,
    admin: HardhatEthersSigner,
    user1: HardhatEthersSigner,
    user2: HardhatEthersSigner,
    erc721One: ERC721,
    erc721OneAddress: string,
    erc721Two: ERC721,
    erc721TwoAddress: string;

  beforeEach(async function () {
    const fixture = await loadFixture(basicFixture);

    xterNFTStaking = fixture.xterNFTStaking;
    xterNFTStakingAddress = fixture.xterNFTStakingAddress;
    admin = fixture.admin;
    user1 = fixture.user1;
    user2 = fixture.user2;
    erc721One = fixture.erc721One;
    erc721OneAddress = fixture.erc721OneAddress;
    erc721Two = fixture.erc721Two;
    erc721TwoAddress = fixture.erc721TwoAddress;

    await xterNFTStaking.connect(admin).setAllowedCollection(erc721OneAddress, true);
    await erc721One.connect(user1).setApprovalForAll(xterNFTStakingAddress, true);
    await erc721One.connect(user2).setApprovalForAll(xterNFTStakingAddress, true);

    await xterNFTStaking.connect(admin).setAllowedCollection(erc721TwoAddress, true);
    await erc721Two.connect(user1).setApprovalForAll(xterNFTStakingAddress, true);
    await erc721Two.connect(user2).setApprovalForAll(xterNFTStakingAddress, true);
  });

  it("Should allow user to stake NFT", async function () {
    const { xterNFTStaking, xterNFTStakingAddress, admin, erc721One, erc721OneAddress, user1, user2 } = await loadFixture(basicFixture);

    // Set the contract to paused state
    await xterNFTStaking.connect(admin).setPaused(true);

    // Attempt to stake while paused, should revert
    await expect(xterNFTStaking.connect(admin).stake(erc721OneAddress, 1)).to.be.revertedWith("Pausable: paused");

    // Unpause the contract
    await xterNFTStaking.connect(admin).setPaused(false);

    // Attempt to stake with user1, should revert as collection is not allowed
    await expect(xterNFTStaking.connect(user1).stake(ethers.ZeroAddress, 1)).to.be.revertedWith("This NFT collection is not allowed");

    // Allow the collection for staking
    await xterNFTStaking.connect(admin).setAllowedCollection(erc721OneAddress, true);

    // Attempt to stake with user1, should revert as user1 is not the owner or approved
    await expect(xterNFTStaking.connect(user2).stake(erc721OneAddress, 1)).to.be.revertedWith("ERC721: caller is not token owner or approved");

    // Approve xterNFTStaking to manage user1's NFT
    await erc721One.connect(user1).setApprovalForAll(xterNFTStakingAddress, true);

    // Now user1 should be able to stake without reverting
    await expect(xterNFTStaking.connect(user1).stake(erc721OneAddress, 1)).to.not.be.reverted;
  });

  it("Should allow user to un-stake NFT when staked", async function () {
    await xterNFTStaking.connect(user1).stake(erc721OneAddress, 1);

    const stakedTokensBefore = await xterNFTStaking.getUserCollectionTokenIds(user1.getAddress(), erc721OneAddress);
    expect(stakedTokensBefore).to.include(BigInt(1));

    await xterNFTStaking.connect(user1).unstake(erc721OneAddress, 1);

    const stakedTokensAfter = await xterNFTStaking.getUserCollectionTokenIds(user1.getAddress(), erc721OneAddress);
    expect(stakedTokensAfter).to.not.include(BigInt(1));
  });

  it("Should not allow user to un-stake NFT that is not staked", async function () {
    await xterNFTStaking.connect(user1).stake(erc721OneAddress, 1);

    const stakedTokens = await xterNFTStaking.getUserCollectionTokenIds(user1.getAddress(), erc721OneAddress);
    expect(stakedTokens).to.include(BigInt(1));

    await expect(xterNFTStaking.connect(user1).unstake(erc721OneAddress, 2)).to.be.revertedWith("Token ID not found in staked tokens");
    await expect(xterNFTStaking.connect(user1).unstake(erc721TwoAddress, 1)).to.be.revertedWith("No tokens staked in this collection");
  });

  it("Should allow multiple users to stake NFTs from both collections and verify holdings", async function () {
    // User1 stakes multiple NFTs from erc721One
    await xterNFTStaking.connect(user1).stake(erc721OneAddress, 1);
    await xterNFTStaking.connect(user1).stake(erc721OneAddress, 2);
    await xterNFTStaking.connect(user1).stake(erc721OneAddress, 3);

    // User2 stakes an NFT from erc721One
    await xterNFTStaking.connect(user2).stake(erc721OneAddress, 11);

    // User1 stakes an NFT from erc721Two
    await xterNFTStaking.connect(user1).stake(erc721TwoAddress, 1);

    // User2 stakes an NFT from erc721Two
    await xterNFTStaking.connect(user2).stake(erc721TwoAddress, 11);

    // Verify that the contract holds the NFTs from both collections
    const user1StakedTokensOne = await xterNFTStaking.getUserCollectionTokenIds(user1.getAddress(), erc721OneAddress);
    const user1StakedTokensTwo = await xterNFTStaking.getUserCollectionTokenIds(user1.getAddress(), erc721TwoAddress);
    const user2StakedTokensOne = await xterNFTStaking.getUserCollectionTokenIds(user2.getAddress(), erc721OneAddress);
    const user2StakedTokensTwo = await xterNFTStaking.getUserCollectionTokenIds(user2.getAddress(), erc721TwoAddress);

    expect(user1StakedTokensOne).to.include(BigInt(1));
    expect(user1StakedTokensOne).to.include(BigInt(2));
    expect(user1StakedTokensOne).to.include(BigInt(3));
    expect(user2StakedTokensOne).to.include(BigInt(11));
    expect(user1StakedTokensTwo).to.include(BigInt(1));
    expect(user2StakedTokensTwo).to.include(BigInt(11));

    const user1TotalStakedCountOne = await xterNFTStaking.getUserTotalStakedCount(user1.getAddress());
    const user1TotalStakedCountTwo = await xterNFTStaking.getUserTotalStakedCount(user2.getAddress());

    expect(user1TotalStakedCountOne).to.equal(4); // 3 from erc721One + 1 from erc721Two
    expect(user1TotalStakedCountTwo).to.equal(2); // 1 from erc721One + 1 from erc721Two

    const tokenId1Owner = await erc721One.ownerOf(1);
    expect(tokenId1Owner).to.equal(xterNFTStakingAddress);
    const tokenId2Owner = await erc721One.ownerOf(2);
    expect(tokenId2Owner).to.equal(xterNFTStakingAddress);
    const tokenId3Owner = await erc721One.ownerOf(3);
    expect(tokenId3Owner).to.equal(xterNFTStakingAddress);
    const tokenId11Owner = await erc721One.ownerOf(11);
    expect(tokenId11Owner).to.equal(xterNFTStakingAddress);
    const tokenId1OwnerTwo = await erc721Two.ownerOf(1);
    expect(tokenId1OwnerTwo).to.equal(xterNFTStakingAddress);
    const tokenId11OwnerTwo = await erc721Two.ownerOf(11);
    expect(tokenId11OwnerTwo).to.equal(xterNFTStakingAddress);


    // then unstake all NFTs from erc721One erc721Two
    await xterNFTStaking.connect(user1).unstake(erc721OneAddress, 1);
    await xterNFTStaking.connect(user1).unstake(erc721OneAddress, 2);
    await xterNFTStaking.connect(user1).unstake(erc721OneAddress, 3);
    await xterNFTStaking.connect(user2).unstake(erc721OneAddress, 11);
    await xterNFTStaking.connect(user1).unstake(erc721TwoAddress, 1);
    await xterNFTStaking.connect(user2).unstake(erc721TwoAddress, 11);

    // verify that user1 and user2 have no NFTs staked
    expect(await xterNFTStaking.getUserCollectionTokenIds(user1.getAddress(), erc721OneAddress)).to.be.empty;
    expect(await xterNFTStaking.getUserCollectionTokenIds(user1.getAddress(), erc721TwoAddress)).to.be.empty;
    expect(await xterNFTStaking.getUserCollectionTokenIds(user2.getAddress(), erc721OneAddress)).to.be.empty;
    expect(await xterNFTStaking.getUserCollectionTokenIds(user2.getAddress(), erc721TwoAddress)).to.be.empty;

    // verify that user1 and user2 hold their origin nfts
    expect(await erc721One.ownerOf(1)).to.equal(await user1.getAddress());
    expect(await erc721One.ownerOf(2)).to.equal(await user1.getAddress());
    expect(await erc721One.ownerOf(3)).to.equal(await user1.getAddress());
    expect(await erc721One.ownerOf(11)).to.equal(await user2.getAddress());
    expect(await erc721Two.ownerOf(1)).to.equal(await user1.getAddress());
    expect(await erc721Two.ownerOf(11)).to.equal(await user2.getAddress());
  });
});


