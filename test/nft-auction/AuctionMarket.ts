
import hre from "hardhat";
import { ethers } from "hardhat";
import { expect } from "chai";
import { deployAuctionMarket } from "../../lib/deploy";
import { AuctionMarket } from "../../typechain-types";
import { nftTradingTestFixture } from "../common_fixtures";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("AuctionMarket", function () {
  const startTime = 1999888777;
  const hour = 60 * 60
  let maxCapacity = 100;// max 100 auctions in heap

  async function basicFixture() {
    const base = await nftTradingTestFixture();
    const [admin, signer, b1, b2, b3, b4, b5] = await hre.ethers.getSigners();

    const gatewayAddress = await base.gateway.getAddress()
    const nftAddress = await base.erc721.getAddress()
    const auctionStartTime = startTime

    const auctionMarket: AuctionMarket = await deployAuctionMarket(gatewayAddress, nftAddress, maxCapacity, auctionStartTime);
    await base.gateway.connect(base.gatewayAdmin).addOperatorWhitelist(await auctionMarket.getAddress());

    return {
      base,
      auctionMarket,
      admin,
      signer,
      b1, b2, b3, b4, b5
    };
  }

  beforeEach(async function () {
    // Reset timestamp
    time.setNextBlockTimestamp(startTime);
  });

  it.only("should place a bid", async function () {
    const { auctionMarket, b1 } = await loadFixture(basicFixture);
    const price = ethers.parseEther("0.5");
    await auctionMarket.connect(b1).placeBid(price, { value: price });
    const userBid = await auctionMarket.userBids(b1.address, 0);
    expect(userBid[1]).to.equal(b1.address);
  });

  it.only("should not place a bid if auction has not started or ended", async function () {
    const { auctionMarket, admin, b1 } = await loadFixture(basicFixture);
    const price = ethers.parseEther("0.5");
    await auctionMarket.connect(admin).setAuctionStartTime(startTime + hour)
    await expect(auctionMarket.placeBid(price, { value: price })).to.be.revertedWith("Auction has not started yet");

    await ethers.provider.send("evm_increaseTime", [73 * hour]); // Increase time by 73 hours
    await expect(auctionMarket.placeBid(price, { value: price })).to.be.revertedWith("Auction has ended");
  });

  it.only("should not place a bid with invalid price", async function () {
    const { auctionMarket } = await loadFixture(basicFixture);

    const price = ethers.parseEther("0.1");
    await expect(auctionMarket.placeBid(price, { value: price })).to.be.revertedWith("Invalid bid price");
  });

  it.only("should not place a bid if maximum bid per user is reached", async function () {
    const { auctionMarket, b1 } = await loadFixture(basicFixture);

    const price = ethers.parseEther("0.5");
    const maxBidsPerUser = await auctionMarket.MAX_BID_PER_USER();
    for (let i = 0; i < maxBidsPerUser; i++) {
      await auctionMarket.connect(b1).placeBid(price, { value: price });
    }

    const higher_price = ethers.parseEther("0.6");
    await expect(auctionMarket.connect(b1).placeBid(higher_price, { value: higher_price })).to.be.revertedWith("Maximum bid per user reached");
  });

  it.only("should claim NFT after auction ends", async function () {
    const { base, auctionMarket, b1, b2 } = await loadFixture(basicFixture);
    const price = ethers.parseEther("0.5");
    await auctionMarket.connect(b1).placeBid(price, { value: price });

    await ethers.provider.send("evm_increaseTime", [73 * hour]); // Increase time by 73 hours
    await auctionMarket.connect(b1).claimAndRefund();
    expect(await base.erc721.balanceOf(b1.address)).to.equal(1);

    const userActiveBidsCnt = await auctionMarket.userActiveBidsCnt(b1.address);
    expect(userActiveBidsCnt).to.equal(0);
  });

  it.only("should claim refund after auction ends", async function () {
    const { auctionMarket, b1, b2, b3 } = await loadFixture(basicFixture);

    const price = ethers.parseEther("0.5");
    await auctionMarket.connect(b1).placeBid(price, { value: price });

    const higher_price = ethers.parseEther("0.55");
    const maxBidsPerUser = await auctionMarket.MAX_BID_PER_USER();
    for (let i = 0; i < maxBidsPerUser; i++) {
      await auctionMarket.connect(b2).placeBid(higher_price, { value: higher_price });
    }
    const higher_price2 = ethers.parseEther("0.555");
    for (let i = 0; i < maxBidsPerUser; i++) {
      await auctionMarket.connect(b3).placeBid(higher_price2, { value: higher_price2 });
    }

    await ethers.provider.send("evm_increaseTime", [73 * 60 * 60]); // Increase time by 73 hours

    const userRefundsBefore = await auctionMarket.userRefunds(b1.address);
    expect(userRefundsBefore).to.equal(price);
    await auctionMarket.connect(b1).claimAndRefund();
    const userRefundsAfter = await auctionMarket.userRefunds(b1.address);
    expect(userRefundsAfter).to.equal(0);
  });

  it.only("should get total value locked (TVL)", async function () {
    const { auctionMarket, b1 } = await loadFixture(basicFixture);

    const price = ethers.parseEther("0.5");
    await auctionMarket.connect(b1).placeBid(price, { value: price });
    const tvl = await auctionMarket.tvl();
    expect(tvl).to.equal(price);
  });

  it.only("should return user bids", async function () {
    const { auctionMarket, b1, b2, b3 } = await loadFixture(basicFixture);
    const maxBidsPerUser = await auctionMarket.MAX_BID_PER_USER();

    const price = ethers.parseEther("0.5");
    for (let i = 0; i < maxBidsPerUser; i++) {
      await auctionMarket.connect(b1).placeBid(price, { value: price });
    }
    const higher_price = ethers.parseEther("0.55");
    for (let i = 0; i < maxBidsPerUser; i++) {
      await auctionMarket.connect(b2).placeBid(higher_price, { value: higher_price });
    }
    const higher_price2 = ethers.parseEther("0.555");
    for (let i = 0; i < maxBidsPerUser; i++) {
      await auctionMarket.connect(b3).placeBid(higher_price2, { value: higher_price2 });
    }

    const userBids = await auctionMarket.getUserBids([b1.address, b2.address, b3.address])
    const userInvalidBids = await auctionMarket.getUserInvalidBids([b1.address, b2.address, b3.address])

    let totalCnt = 0, inValidCnt = 0
    userBids.forEach((bids) => {
      bids.forEach((bid) => {
        totalCnt += 1
        // expect(bid[0]).to.be.oneOf([b2.address, b3.address]);
        expect([b1.address, b2.address, b3.address]).to.include(bid[1]);
      })
    });
    userInvalidBids.forEach((bids) => {
      bids.forEach((bid) => {
        inValidCnt += 1
        expect(bid[1]).to.equal(b1.address);
      })
    });
    expect(await auctionMarket.getUserActiveBidsCnt([b1.address, b2.address, b3.address])).to.equal(totalCnt - inValidCnt)
  });

  it.only("should past 3000 MAX_BID_PER_USER with 5000+ bids", async function () {
    this.timeout(5000 * 1000);

    const { auctionMarket, base, admin, b1, b2, b3, b4 } = await loadFixture(basicFixture);
    await auctionMarket.connect(admin).setMaxBidPerUser(3000);
    const maxBidsPerUser = await auctionMarket.MAX_BID_PER_USER();

    let b1Total = BigInt(0)
    for (let i = 0; i < maxBidsPerUser; i++) {
      const price = ethers.parseEther(`${0.25 + 0.00001 * i}`);
      console.log('b1 price ----', price);
      await auctionMarket.connect(b1).placeBid(price, { value: price });
      b1Total += price
    }

    for (let i = 0; i < maxBidsPerUser; i++) {
      const price = ethers.parseEther(`${0.3 + 0.00001 * i}`);
      console.log('b2 price ----', price);
      await auctionMarket.connect(b2).placeBid(price, { value: price });
    }

    for (let i = 0; i < 50; i++) {
      const price = ethers.parseEther(`${0.5 + 0.00001 * i}`);
      console.log('b3 price ----', price);
      await auctionMarket.connect(b3).placeBid(price, { value: price });
    }

    await ethers.provider.send("evm_increaseTime", [73 * 60 * 60]); // Increase time by 73 hours
    const totalBidsCnt = await auctionMarket.getTotalBidsCnt();
    expect(totalBidsCnt).to.equal(2 * Number(maxBidsPerUser) + 50);
    console.log('totalBidsCnt ==', totalBidsCnt);


    const userActiveBidsCnt1 = await auctionMarket.userActiveBidsCnt(b1.address);
    const userRefunds1 = await auctionMarket.userRefunds(b1.address);
    console.log('b1 userActiveBidsCnt ==', userActiveBidsCnt1);
    console.log('b1 userRefunds1 ==', userRefunds1);

    const userActiveBidsCnt2 = await auctionMarket.userActiveBidsCnt(b2.address);
    const userRefunds2 = await auctionMarket.userRefunds(b2.address);
    console.log('b2 userActiveBidsCnt ==', userActiveBidsCnt2);
    console.log('b2 userRefunds2 ==', userRefunds2);

    const userActiveBidsCnt3 = await auctionMarket.userActiveBidsCnt(b3.address);
    const userRefunds3 = await auctionMarket.userRefunds(b3.address);
    console.log('b3 userActiveBidsCnt ==', userActiveBidsCnt3);
    console.log('b3 userRefunds3 ==', userRefunds3);

    await auctionMarket.connect(b3).claimAndRefund();
    expect(Number(await base.erc721.balanceOf(b3.address))).to.equal(50);


    const userRefundsBefore = await auctionMarket.userRefunds(b1.address);
    expect(userRefundsBefore).to.equal(b1Total);
    await auctionMarket.connect(b1).claimAndRefund();
    const userRefundsAfter = await auctionMarket.userRefunds(b1.address);
    expect(userRefundsAfter).to.equal(0);
  });
});

