import hre from "hardhat";
import ethers from "ethers";
import { expect } from "chai";
import { deployDepositRaffleMinter } from "../../lib/deploy";
import { DepositRaffleMinter } from "../../typechain-types";
import { loadFixture, mine, setBalance, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { nftTradingTestFixture } from "../common_fixtures";
import * as fs from 'fs';

const initialStartTime = 1903490000;
const initialEndTime = 1903490000;
const duration = 3600;
const unitPrice = hre.ethers.parseEther('0.01');
const maxShare = 10;
const nftPrice = hre.ethers.parseEther('0');
const nftAmount = 5;
const nftAmountLarge = 100;

const deposit = async ({
  depositRaffleMinter,
  user,
  share,
}: {
  depositRaffleMinter: DepositRaffleMinter;
  user: ethers.Signer;
  share: number;
}) => {
  const gasEstimated = await depositRaffleMinter.connect(user).deposit.estimateGas(share, { value: unitPrice * BigInt(share) });
  const gasLimit = gasEstimated + gasEstimated / BigInt(2);
  return depositRaffleMinter.connect(user).deposit(share, { value: unitPrice * BigInt(share), gasLimit });
};

const randomUser = async () => {
  const wallet = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  await setBalance(wallet.address, hre.ethers.parseEther("100"));
  return wallet;
};

async function fixture(_nftAmount?: number) {
  const base = await nftTradingTestFixture();
  const [, , , admin, paymentReceiver, u1, u2] = await hre.ethers.getSigners();
  const gatewayAddress = await base.gateway.getAddress();
  const nftAddress = await base.erc721.getAddress();

  const depositRaffleMinter = await deployDepositRaffleMinter(
    admin.address,
    gatewayAddress,
    nftAddress,
    paymentReceiver.address,
    initialStartTime,
    initialEndTime,
    unitPrice,
    maxShare,
    nftPrice,
    _nftAmount ?? nftAmount
  );

  await base.gateway.connect(base.gatewayAdmin).addOperatorWhitelist(await depositRaffleMinter.getAddress());
  expect(await base.gateway.nftManager(nftAddress)).equal(base.nftManager.address, "nftManager matched");

  await depositRaffleMinter.connect(admin).setAuctionStartTime((await time.latest()));
  await depositRaffleMinter.connect(admin).setAuctionEndTime((await time.latest()) + duration);

  return {
    ...base,
    depositRaffleMinter,
    admin,
    paymentReceiver,
    u1,
    u2,
  };
}

async function largeFixture() {
  return fixture(nftAmountLarge);
}

// struct Bid {
//   uint32 id;
//   address bidder;
//   uint32 timestamp;
//   uint32 share;
//   uint256 price;
// }

describe("DepositRaffleMinter", function () {
  it("should deposit", async function () {
    const { depositRaffleMinter, admin } = await loadFixture(fixture);
    const user = await randomUser();
    const share = 1;

    await deposit({ depositRaffleMinter, user, share });

    const userBid = await depositRaffleMinter.userBids(user.address, 0);
    expect(userBid[1]).to.equal(user.address);
    expect(userBid[3]).to.equal(share);
  });

  it("should not deposit if auction has not started, has ended, or maximum deposit per user is reached", async function () {
    const { depositRaffleMinter, admin } = await loadFixture(fixture);
    const user = await randomUser();
    const share = 1;

    // Maximum deposit per user reached
    await deposit({ depositRaffleMinter, user, share });
    await expect(deposit({ depositRaffleMinter, user, share })).to.be.revertedWith("DepositRaffleMinter: buyer limit exceeded");

    // Auction has not started
    await depositRaffleMinter.connect(admin).setAuctionStartTime((await time.latest()) + duration);
    await expect(deposit({ depositRaffleMinter, user, share })).to.be.revertedWith("DepositRaffleMinter: deposit time invalid");

    // Auction has ended
    await time.increase(duration + 600);
    await expect(deposit({ depositRaffleMinter, user, share })).to.be.revertedWith("DepositRaffleMinter: deposit time invalid");
  });

  it("should allow different types of share for deposit", async function () {
    const { depositRaffleMinter } = await loadFixture(fixture);
    const user = await randomUser();
    const user2 = await randomUser();
    const user3 = await randomUser();
    const user4 = await randomUser();

    // Deposit with share value of 1
    await deposit({ depositRaffleMinter, user, share: 1 });
    let userBid = await depositRaffleMinter.userBids(user.address, 0);
    expect(userBid[3]).to.equal(1);

    // Deposit with share value of 5
    await deposit({ depositRaffleMinter, user: user2, share: 5 });
    userBid = await depositRaffleMinter.userBids(user2.address, 0);
    expect(userBid[3]).to.equal(5);

    // Deposit with share value of 10
    await deposit({ depositRaffleMinter, user: user3, share: 10 });
    userBid = await depositRaffleMinter.userBids(user3.address, 0);
    expect(userBid[3]).to.equal(10);

    // Deposit with share value of 11, expected to be failed
    await expect(deposit({ depositRaffleMinter, user: user4, share: 11 })).to.be.revertedWith("DepositRaffleMinter: payment mismatch");
  });

  describe("Claim", function () {
    it("normal claim with 2 shares", async function () {
      const { depositRaffleMinter, admin, erc721, nftManager, u1 } = await loadFixture(fixture);

      const TotalDepositCnt = 50
      const share = 2
      // deposit 
      const users = [];
      for (let i = 0; i < TotalDepositCnt; i++) {
        const u = await randomUser();
        users.push(u);
        await deposit({ depositRaffleMinter, user: u, share: share })
      }

      // increase timestamp to auction ended
      await time.increase(duration + 600);

      expect(await depositRaffleMinter.tvl()).equal(hre.ethers.parseEther((0.01 * share * (TotalDepositCnt)).toString()));
      expect(await depositRaffleMinter.getTotalBidsCnt()).equal(TotalDepositCnt);
      expect(depositRaffleMinter.connect(u1).claimAndRefund()).to.be.revertedWith("DepositRaffleMinter: nothing to claim");

      const claimInfos = await depositRaffleMinter.getUserClaimInfos(users.map((u) => u.address));

      const winners = new Set()
      // calculate winStart & every user win
      const winStart = Number(await depositRaffleMinter.winStart())
      for (let i = 0; i < TotalDepositCnt; i++) {
        const claimInfo = claimInfos[i];
        const userBid = await depositRaffleMinter.userBids(users[i], 0);
        const bidIndex = Number(await depositRaffleMinter.bidIndex(userBid.id))
        if (bidIndex >= winStart && bidIndex < winStart + nftAmount) {
          winners.add(userBid.id)
          console.log(`--------[i: ${i}, id: ${userBid.id}, address: ${userBid.bidder}] win --------`)
          // console.log('claimInfo ==', claimInfo)
          expect(claimInfo.hasClaimed).equal(false);
          expect(claimInfo.nftCount).equal(1);
          expect(claimInfo.refundAmount).equal(unitPrice * BigInt(share) - nftPrice);
          await depositRaffleMinter.connect(users[i]).claimAndRefund();
          expect(await erc721.balanceOf(users[i])).equal(1);
          expect((await depositRaffleMinter.claimInfo(users[i].address)).hasClaimed).equal(true);
          expect(depositRaffleMinter.claimInfo(users[i].address)).to.be.revertedWith("DepositRaffleMinter: has claimed");
        } else {
          console.log('---- not win ----')
          expect(claimInfo.hasClaimed).equal(false);
          expect(claimInfo.nftCount).equal(0);
          expect(claimInfo.refundAmount).equal(unitPrice * BigInt(share));
          await depositRaffleMinter.connect(users[i]).claimAndRefund();
          expect(await erc721.balanceOf(users[i])).equal(0);
          expect((await depositRaffleMinter.claimInfo(users[i].address)).hasClaimed).equal(true);
          expect(depositRaffleMinter.claimInfo(users[i].address)).to.be.revertedWith("DepositRaffleMinter: has claimed");
        }
      }

      // getWinnerBids
      // const winnerBids = await depositRaffleMinter.getWinnerBids(0, 5);
      // console.log('winnerBids ==', winnerBids)

      const batchSize = 2
      for (let startIdx = 0; startIdx < nftAmount; startIdx += batchSize) {
        const winnerBids = await depositRaffleMinter.getWinnerBids(startIdx, batchSize);
        // console.log('startIdx ==', startIdx)
        // console.log('winnerBids ==', winnerBids)
        for (let i = 0; i < winnerBids.length; i++) {
          expect(winners.has(winnerBids[i].id)).equal(true);
        }
      }
    });

    it("claim with random shares", async function () {
      const { depositRaffleMinter, admin, erc721, nftManager, u1 } = await loadFixture(fixture);
      const TotalDepositCnt = 50
      // deposit 
      const users = [];
      const shares = [];
      for (let i = 0; i < TotalDepositCnt; i++) {
        const u = await randomUser();
        users.push(u);
        const share = Math.floor(Math.random() * 10) + 1; // Generate a random share between 1 and 10
        shares.push(share)
        await deposit({ depositRaffleMinter, user: u, share: share })
      }

      // increase timestamp to auction ended
      await time.increase(duration + 600);
      const claimInfos = await depositRaffleMinter.getUserClaimInfos(users.map((u) => u.address));

      const winners = new Set()
      // calculate winStart & every user win
      const winStart = Number(await depositRaffleMinter.winStart())
      for (let i = 0; i < TotalDepositCnt; i++) {
        const claimInfo = claimInfos[i];
        const userBid = await depositRaffleMinter.userBids(users[i], 0);
        const bidIndex = Number(await depositRaffleMinter.bidIndex(userBid.id))
        if (bidIndex >= winStart && bidIndex < winStart + nftAmount) {
          winners.add(userBid.id)
          console.log(`--------[i: ${i}, id: ${userBid.id}, share: ${shares[i]}, address: ${userBid.bidder}] win --------`)
          expect(claimInfo.hasClaimed).equal(false);
          expect(claimInfo.nftCount).equal(1);
          expect(claimInfo.refundAmount).equal(unitPrice * BigInt(shares[i]) - nftPrice);
          await depositRaffleMinter.connect(users[i]).claimAndRefund();
          expect(await erc721.balanceOf(users[i])).equal(1);
        } else {
          console.log(`--------[share: ${shares[i]}] not win --------`)
          expect(claimInfo.hasClaimed).equal(false);
          expect(claimInfo.nftCount).equal(0);
          expect(claimInfo.refundAmount).equal(unitPrice * BigInt(shares[i]));
          await depositRaffleMinter.connect(users[i]).claimAndRefund();
          expect(await erc721.balanceOf(users[i])).equal(0);
        }
      }

      const batchSize = 2
      for (let startIdx = 0; startIdx < nftAmount; startIdx += batchSize) {
        const winnerBids = await depositRaffleMinter.getWinnerBids(startIdx, batchSize);
        // console.log('startIdx ==', startIdx)
        // console.log('winnerBids ==', winnerBids)
        for (let i = 0; i < winnerBids.length; i++) {
          expect(winners.has(winnerBids[i].id)).equal(true);
        }
      }
    });
  });

  describe("Management", function () {
    it("should have valid access control", async function () {
      const { depositRaffleMinter, gateway, admin, u1, u2, erc721 } = await loadFixture(fixture);
      // set gateway
      expect(depositRaffleMinter.setGateway(gateway.target)).to.be.reverted;
      await depositRaffleMinter.connect(admin).setGateway(gateway.target);
      // set payment receiver
      expect(depositRaffleMinter.setRecipient(u1.address)).to.be.reverted;
      await depositRaffleMinter.connect(admin).setRecipient(u1.address);

      await depositRaffleMinter.connect(admin).grantRole(await depositRaffleMinter.MANAGER_ROLE(), u2.address);
      // set nft address
      expect(depositRaffleMinter.setNftAddress(erc721.target)).to.be.reverted;
      await depositRaffleMinter.connect(u2).setNftAddress(erc721.target);

      // set limit for buyer amount
      expect(depositRaffleMinter.setLimitForBuyerAmount(2)).to.be.reverted;
      await depositRaffleMinter.connect(admin).setLimitForBuyerAmount(2);

      // set auction end time
      expect(depositRaffleMinter.setAuctionEndTime((await time.latest()) + 600)).to.be.reverted;
      expect(depositRaffleMinter.connect(u2).setAuctionEndTime((await time.latest()) - 600)).to.be.revertedWith(
        "DepositRaffleMinter: invalid timestamp"
      );
      await depositRaffleMinter.connect(u2).setAuctionEndTime((await time.latest()) + 600);
      time.setNextBlockTimestamp((await time.latest()) + 600);
      expect(depositRaffleMinter.connect(u2).setAuctionEndTime((await time.latest()) + 600)).to.be.revertedWith(
        "DepositRaffleMinter: already ended"
      );
    });

    it("should allow manager to set NFT amount", async function () {
      const { depositRaffleMinter, admin } = await loadFixture(fixture);
      // Set a new NFT amount
      const newNftAmount = 3;
      await depositRaffleMinter.connect(admin).setNftAmount(newNftAmount);
      // Check if the new NFT amount has been set
      expect(await depositRaffleMinter.nftAmount()).to.equal(newNftAmount);

      expect(depositRaffleMinter.connect(admin).setNftAmount(10000)).to.be.revertedWith(
        "DepositRaffleMinter: nftAmount can not increase"
      );
    });
  });
});

describe("DepositRaffleMinter Large Dataset", function () {
  this.timeout(14400000);

  it.skip("large dataset raffle deposit with random shares", async function () {
    const { depositRaffleMinter, admin, erc721, nftManager, u1 } = await loadFixture(largeFixture);
    await depositRaffleMinter.connect(admin).setAuctionEndTime((await time.latest()) + duration * 1000);

    const TotalDepositCnt = 500
    // deposit 
    const users = [];
    const shares = [];
    for (let i = 0; i < TotalDepositCnt; i++) {
      const u = await randomUser();
      users.push(u);
      const share = Math.floor(Math.random() * 10) + 1; // Generate a random share between 1 and 10
      shares.push(share)

      if (i % 100 === 99 || i == TotalDepositCnt - 1) {
        console.log(`generating users and shares ${i + 1} / ${TotalDepositCnt}`);
      }
    }

    console.log("users & shares generated");

    // refer to https://stackoverflow.com/questions/72497597/how-to-make-local-hardhat-network-run-faster
    // enable manual mining
    await hre.network.provider.send("evm_setAutomine", [false]);
    await hre.network.provider.send("evm_setIntervalMining", [0]);

    console.log("large # of deposit now");
    let numPlaced = 0;
    const afterDeposited = async () => {
      numPlaced++;
      if (numPlaced % 10 == 0 || numPlaced == TotalDepositCnt) {
        console.log(`depositing ${numPlaced} / ${TotalDepositCnt}`);
        await mine(1);
        console.log(`minted: ${await depositRaffleMinter.getTotalBidsCnt()}`)
      }
    };

    for (let i = 0; i < TotalDepositCnt; i++) {
      await deposit({ depositRaffleMinter, user: users[i], share: shares[i] })
      await afterDeposited();
    }

    let i = 0;
    while (await depositRaffleMinter.getTotalBidsCnt() < TotalDepositCnt) {
      await mine(10);
      console.log(`minted: ${await depositRaffleMinter.getTotalBidsCnt()}`)
      await new Promise(resolve => setTimeout(resolve, 1000)); // 延迟操作 1s
      i++;
      if (i > 10) {
        throw new Error("not mined")
      }
    }
    // re-enable automining when you are done, so you dont need to manually mine future blocks
    await hre.network.provider.send("evm_setAutomine", [true]);


    console.log(`getTotalBidsCnt: ${await depositRaffleMinter.getTotalBidsCnt()}`)

    console.log("all deposit done!!!!");

    // increase timestamp to auction ended
    await time.increase(duration * 1000 + 600);
    expect(await depositRaffleMinter.getTotalBidsCnt()).equal(TotalDepositCnt);

    const claimInfos = await depositRaffleMinter.getUserClaimInfos(users.map((u) => u.address));
    // console.log('claimInfos.length ==', claimInfos.length);

    // calculate winStart & every user win
    const winners = new Set()
    let winnersAdded = 0;
    const afterWinnersAdded = async () => {
      winnersAdded++;
      if (winnersAdded % 10 == 0 || winnersAdded == TotalDepositCnt) {
        console.log(`winnersAdded ${winnersAdded} / ${TotalDepositCnt}`);
      }
    };

    const winStart = Number(await depositRaffleMinter.winStart())
    for (let i = 0; i < TotalDepositCnt; i++) {
      const claimInfo = claimInfos[i];
      const userBid = await depositRaffleMinter.userBids(users[i], 0);
      const bidIndex = Number(await depositRaffleMinter.bidIndex(userBid.id))
      if (bidIndex >= winStart && bidIndex < winStart + nftAmountLarge) {
        winners.add(userBid.id)
        // console.log(`--------[i: ${i}, id: ${userBid.id}, share: ${shares[i]}, address: ${userBid.bidder}] win --------`)
        expect(claimInfo.hasClaimed).equal(false);
        expect(claimInfo.nftCount).equal(1);
        expect(claimInfo.refundAmount).equal(unitPrice * BigInt(shares[i]) - nftPrice);
        await depositRaffleMinter.connect(users[i]).claimAndRefund();
        expect(await erc721.balanceOf(users[i])).equal(1);
      } else {
        // console.log(`--------[share: ${shares[i]}] not win --------`)
        expect(claimInfo.hasClaimed).equal(false);
        expect(claimInfo.nftCount).equal(0);
        expect(claimInfo.refundAmount).equal(unitPrice * BigInt(shares[i]));
        await depositRaffleMinter.connect(users[i]).claimAndRefund();
        expect(await erc721.balanceOf(users[i])).equal(0);
      }
      await afterWinnersAdded()
    }

    expect(winners.size).equal(nftAmountLarge);

    const batchSize = 50
    const allWinnerBids = [];
    for (let startIdx = 0; startIdx < nftAmountLarge; startIdx += batchSize) {
      const winnerBids = await depositRaffleMinter.getWinnerBids(startIdx, batchSize);
      allWinnerBids.push(...winnerBids);
      for (let i = 0; i < winnerBids.length; i++) {
        expect(winners.has(winnerBids[i].id)).equal(true);
      }
    }
    const csvData = allWinnerBids.map((bid) => `${bid.id},${bid.bidder},${bid.timestamp},${bid.share},${bid.price}`).join('\n');
    fs.writeFileSync('winnerBids.csv', 'id,bidder,timestamp,share,unitPrice\n' + csvData, 'utf-8');
  });
});
