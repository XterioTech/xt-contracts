import hre from "hardhat";
import ethers from "ethers";
import { expect } from "chai";
import { deployRaffleAuctionMinter } from "../../lib/deploy";
import { RaffleAuctionMinter } from "../../typechain-types";
import { nftTradingTestFixture } from "../common_fixtures";
import { loadFixture, mine, setBalance, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { signAuctionMinterBid } from "../../lib/signature";

const initialEndTime = 2903490000;
const duration = 3600;
const nftCount = 10;
const nftCountLarge = 1000;

const placeBid = async ({
  auctionMinter,
  signer,
  user,
  bidPrice,
  limitID = 0,
  limitAmount = 1,
  expire,
}: {
  auctionMinter: RaffleAuctionMinter;
  signer: ethers.Signer;
  user: ethers.Signer;
  bidPrice: string | bigint;
  limitID?: number;
  limitAmount?: number;
  expire?: number;
}) => {
  const priceRaw = typeof bidPrice === "string" ? hre.ethers.parseEther(bidPrice) : bidPrice;
  expire = expire || (await time.latest()) + 500;
  const signature = await signAuctionMinterBid(
    signer,
    await user.getAddress(),
    priceRaw,
    limitID,
    limitAmount,
    expire,
    auctionMinter.target
  );
  return auctionMinter.connect(user).placeBid(priceRaw, limitID, limitAmount, expire, signature, { value: priceRaw });
};

const randomUser = async () => {
  const wallet = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  await setBalance(wallet.address, hre.ethers.parseEther("100"));
  return wallet;
};

function shuffleArray(origin: any[]) {
  const array = [...origin];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function fixtureWithNFTCount(cnt: number) {
  const base = await nftTradingTestFixture();
  const [, , , admin, paymentReceiver, u1, u2] = await hre.ethers.getSigners();

  const gatewayAddress = await base.gateway.getAddress();
  const nftAddress = await base.erc721.getAddress();

  const auctionMinter = await deployRaffleAuctionMinter(
    admin.address,
    gatewayAddress,
    nftAddress,
    paymentReceiver.address,
    cnt,
    initialEndTime
  );
  await base.gateway.connect(base.gatewayAdmin).addOperatorWhitelist(await auctionMinter.getAddress());

  expect(await base.gateway.nftManager(nftAddress)).equal(base.nftManager.address, "nftManager matched");

  return {
    ...base,
    auctionMinter,
    admin,
    paymentReceiver,
    u1,
    u2,
  };
}

async function basicFixture() {
  return fixtureWithNFTCount(nftCount);
}

async function largeFixture() {
  return fixtureWithNFTCount(nftCountLarge);
}

describe("RaffleAuctionMinter Bid", function () {
  it("should place a bid", async function () {
    const { auctionMinter, admin, nftManager, u1 } = await loadFixture(basicFixture);
    await auctionMinter.connect(admin).setAuctionEndTime((await time.latest()) + duration);

    await placeBid({
      auctionMinter,
      signer: nftManager,
      user: u1,
      bidPrice: "0.5",
    });
    const userBid = await auctionMinter.userBids(u1.address, 0);
    expect(userBid[1]).to.equal(u1.address);

    expect(auctionMinter.connect(u1).claimAndRefund()).to.be.revertedWith(
      "RaffleAuctionMinter: No claims or refunds allowed until auction ends"
    );
    expect(auctionMinter.sendPayment()).to.be.revertedWith(
      "RaffleAuctionMinter: payment can only be made after the auction has ended"
    );
  });

  it("should not place a bid if signature is invalid", async function () {
    const { auctionMinter, admin, nftManager, u1 } = await loadFixture(basicFixture);
    await auctionMinter.connect(admin).setAuctionEndTime((await time.latest()) + duration);

    await expect(
      placeBid({
        auctionMinter,
        signer: nftManager,
        user: u1,
        bidPrice: "0.5",
        expire: await time.latest(),
      })
    ).to.be.revertedWith("RaffleAuctionMinter: signature expired");

    await expect(
      placeBid({
        auctionMinter,
        signer: u1,
        user: u1,
        bidPrice: "0.5",
      })
    ).to.be.revertedWith("RaffleAuctionMinter: invalid signature");
  });

  it("cannot perform claimInfo operation until the auction ends", async function () {
    const { auctionMinter, admin, nftManager, u1 } = await loadFixture(basicFixture);
    await expect(
      auctionMinter.getUserClaimInfos([u1.address])
    ).to.be.revertedWith("RaffleAuctionMinter: No claimInfo allowed until auction ends");
  });

  it("should not place a bid if auction has ended", async function () {
    const { auctionMinter, admin, nftManager, u1 } = await loadFixture(basicFixture);
    await auctionMinter.connect(admin).setAuctionEndTime((await time.latest()) + duration);

    await time.increase(duration + 600);
    await expect(
      placeBid({
        auctionMinter,
        signer: nftManager,
        user: u1,
        bidPrice: "0.5",
      })
    ).to.be.revertedWith("RaffleAuctionMinter: auction ended");
  });

  it("should not place a bid if maximum bid per user is reached", async function () {
    const { auctionMinter, admin, nftManager, u1, u2 } = await loadFixture(basicFixture);
    await auctionMinter.connect(admin).setAuctionEndTime((await time.latest()) + duration);

    await placeBid({
      auctionMinter,
      signer: nftManager,
      user: u1,
      bidPrice: "0.5",
      limitID: 1,
      limitAmount: 1,
    });
    await expect(
      placeBid({
        auctionMinter,
        signer: nftManager,
        user: u1,
        bidPrice: "0.5",
        limitID: 1,
        limitAmount: 1,
      })
    ).to.be.revertedWith("RaffleAuctionMinter: buyer limit exceeded");

    await placeBid({
      auctionMinter,
      signer: nftManager,
      user: u1,
      bidPrice: "0.5",
      limitID: 2,
      limitAmount: 1,
    });

    await placeBid({
      auctionMinter,
      signer: nftManager,
      user: u2,
      bidPrice: "0.5",
      limitID: 1,
      limitAmount: 1,
    });
  });
});

describe("RaffleAuctionMinter Claim", function () {
  it("all the same bid price", async function () {
    const { auctionMinter, admin, erc721, nftManager, u1 } = await loadFixture(basicFixture);
    await auctionMinter.connect(admin).setAuctionEndTime((await time.latest()) + duration);

    // place bid
    const users = [];
    for (let i = 0; i < nftCount + 1; i++) {
      const u = await randomUser();
      users.push(u);
      await placeBid({
        auctionMinter,
        signer: nftManager,
        user: u,
        bidPrice: "0.5",
      });
    }

    // increase timestamp to auction ended
    await time.increase(duration + 600);

    const finalPrice = hre.ethers.parseEther("0.5");
    const floorBid = await auctionMinter.floorBid();
    expect(floorBid.price).equal(finalPrice, "floor bid price not correct");

    expect(await auctionMinter.tvl()).equal(hre.ethers.parseEther((0.5 * (nftCount + 1)).toString()));
    expect(await auctionMinter.getTotalBidsCnt()).equal(nftCount + 1);


    const claimInfos = await auctionMinter.getUserClaimInfos(users.map((u) => u.address));
    for (let i = 0; i < users.length; i++) {
      const claimInfo = claimInfos[i];
      expect(claimInfo.hasClaimed).equal(false);
      await auctionMinter.connect(users[i]).claimAndRefund();
      expect((await auctionMinter.claimInfo(users[i].address)).hasClaimed).equal(true);
      expect(auctionMinter.claimInfo(users[i].address)).to.be.revertedWith("RaffleAuctionMinter: has claimed");
    }

    await auctionMinter.connect(admin).setRecipient(u1.address);
    const oldBalance = await hre.ethers.provider.getBalance(u1.address);
    await auctionMinter.sendPayment();
    const newBalance = await hre.ethers.provider.getBalance(u1.address);
    expect(newBalance - oldBalance).equal(finalPrice * BigInt(nftCount));
  });
});

describe("RaffleAuctionMinter Management", function () {
  it("should have valid access control", async function () {
    const { auctionMinter, gateway, admin, u1, u2, erc721 } = await loadFixture(basicFixture);
    // set gateway
    expect(auctionMinter.setGateway(gateway.target)).to.be.reverted;
    await auctionMinter.connect(admin).setGateway(gateway.target);
    // set payment receiver
    expect(auctionMinter.setRecipient(u1.address)).to.be.reverted;
    await auctionMinter.connect(admin).setRecipient(u1.address);

    await auctionMinter.connect(admin).grantRole(await auctionMinter.MANAGER_ROLE(), u2.address);
    // set nft address
    expect(auctionMinter.setNftAddress(erc721.target)).to.be.reverted;
    await auctionMinter.connect(u2).setNftAddress(erc721.target);
    // set auction end time
    expect(auctionMinter.setAuctionEndTime((await time.latest()) + 600)).to.be.reverted;
    expect(auctionMinter.connect(u2).setAuctionEndTime((await time.latest()) - 600)).to.be.revertedWith(
      "RaffleAuctionMinter: invalid timestamp"
    );
    await auctionMinter.connect(u2).setAuctionEndTime((await time.latest()) + 600);
    time.setNextBlockTimestamp((await time.latest()) + 600);
    expect(auctionMinter.connect(u2).setAuctionEndTime((await time.latest()) + 600)).to.be.revertedWith(
      "RaffleAuctionMinter: already ended"
    );
  });
});

describe("RaffleAuctionMinter Large Dataset", function () {
  this.timeout(14400000);

  it.skip("large number of bids", async function () {
    const { auctionMinter, admin, erc721, nftManager, paymentReceiver } = await loadFixture(largeFixture);
    await auctionMinter.connect(admin).setAuctionEndTime((await time.latest()) + duration * 1000);

    // place bid
    const users = [];
    const prices = [];
    const totalBids = Math.floor(nftCountLarge * 1.1);
    for (let i = 0; i < totalBids; i++) {
      const u = await randomUser();
      const price = ((i + 1) / 1000.0).toFixed(3);
      users.push(u);
      prices.push(hre.ethers.parseEther(price));
      if (i % 100 === 99 || i == totalBids - 1) {
        console.log(`generating users and prices ${i + 1} / ${totalBids}`);
      }
    }
    const shuffledPrices = shuffleArray(prices);

    console.log("users and prices generated");

    // refer to https://stackoverflow.com/questions/72497597/how-to-make-local-hardhat-network-run-faster
    // enable manual mining
    await hre.network.provider.send("evm_setAutomine", [false]);
    await hre.network.provider.send("evm_setIntervalMining", [0]);

    console.log("place bids now");
    let numPlaced = 0;
    const afterBidPlaced = async () => {
      numPlaced++;
      if (numPlaced % 10 == 0 || numPlaced == totalBids) {
        console.log(`placing bids ${numPlaced} / ${totalBids}`);
        await mine(1);
      }
    };

    for (let i = 0; i < totalBids; i++) {
      await placeBid({
        auctionMinter,
        signer: nftManager,
        user: users[i],
        bidPrice: shuffledPrices[i],
      });
      await afterBidPlaced();
    }

    while (await auctionMinter.getTotalBidsCnt() < totalBids) {
      await mine(10);
      console.log(`minted: ${await auctionMinter.getTotalBidsCnt()}`)
    }

    // re-enable automining when you are done, so you dont need to manually mine future blocks
    await hre.network.provider.send("evm_setAutomine", [true]);

    console.log("all bids placed");
    // increase timestamp to auction ended
    await time.increase(duration * 1000 + 600);

    expect(await auctionMinter.getTotalBidsCnt()).equal(totalBids);
    // final target price: prices[nftCountLarge]
    const finalPrice = prices[totalBids - nftCountLarge];
    const floorBid = await auctionMinter.floorBid();
    expect(floorBid.price).equal(finalPrice, "floor bid price not correct");

    for (let i = 0; i < totalBids; i++) {
      const claimInfo = await auctionMinter.claimInfo(users[i].address);
      expect(claimInfo.hasClaimed).equal(false);
      if (shuffledPrices[i] >= finalPrice) {
        expect(claimInfo.refundAmount).equal(shuffledPrices[i] - finalPrice);
        expect(claimInfo.nftCount).equal(1);
      } else {
        expect(claimInfo.refundAmount).equal(shuffledPrices[i]);
        expect(claimInfo.nftCount).equal(0);
      }
      if (i % 100 == 99) {
        console.log(`checking claim info ${i + 1} / ${totalBids}`);
        await auctionMinter.connect(users[i]).claimAndRefund();
        expect(await erc721.balanceOf(users[i])).equal(claimInfo.nftCount);
      }
    }

    const oldBalance = await hre.ethers.provider.getBalance(paymentReceiver.address);
    await auctionMinter.sendPayment();
    const newBalance = await hre.ethers.provider.getBalance(paymentReceiver.address);
    expect(newBalance - oldBalance).equal(finalPrice * BigInt(nftCountLarge));
  });
});
