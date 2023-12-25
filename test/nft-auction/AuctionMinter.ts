import hre from "hardhat";
import ethers from "ethers";
import { expect } from "chai";
import { deployAuctionMinter } from "../../lib/deploy";
import { AuctionMinter } from "../../typechain-types";
import { nftTradingTestFixture } from "../common_fixtures";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { signAuctionMinterBid } from "../../lib/signature";

const initialEndTime = 1903490000;
const duration = 3600;
const nftCount = 100;

const placeBid = async ({
  auctionMinter,
  signer,
  user,
  bidPrice,
  limitID = 0,
  limitAmount = 1,
  expire,
}: {
  auctionMinter: AuctionMinter;
  signer: ethers.Signer;
  user: ethers.Signer;
  bidPrice: string;
  limitID?: number;
  limitAmount?: number;
  expire?: number;
}) => {
  const priceRaw = hre.ethers.parseEther(bidPrice);
  expire = expire || await time.latest() + 500
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

describe("AuctionMinter", function () {
  async function basicFixture() {
    const base = await nftTradingTestFixture();
    const [, , , admin, paymentReceiver, u1, u2, u3, u4] = await hre.ethers.getSigners();

    const gatewayAddress = await base.gateway.getAddress();
    const nftAddress = await base.erc721.getAddress();

    const auctionMinter = await deployAuctionMinter(
      admin.address,
      gatewayAddress,
      nftAddress,
      paymentReceiver.address,
      nftCount,
      initialEndTime
    );
    await base.gateway.connect(base.gatewayAdmin).addOperatorWhitelist(await auctionMinter.getAddress());

    expect(await base.gateway.nftManager(nftAddress)).equal(base.nftManager.address, "nftManager matched");

    return {
      ...base,
      admin,
      auctionMinter,
      u1,
      u2,
      u3,
      u4,
    };
  }

  beforeEach(async function () {
    const { auctionMinter, admin } = await loadFixture(basicFixture);
    
  });


  it.only("should place a bid", async function () {
    const { auctionMinter, admin, nftManager, u1 } = await loadFixture(basicFixture);
    await auctionMinter.connect(admin).setAuctionEndTime(await time.latest() + duration);
    await placeBid({
      auctionMinter,
      signer: nftManager,
      user: u1,
      bidPrice: "0.5",
    });
    const userBid = await auctionMinter.userBids(u1.address, 0);
    expect(userBid[1]).to.equal(u1.address);
  });

  it.only("should not place a bid if auction has ended", async function () {
    const { auctionMinter, admin, nftManager, u1 } = await loadFixture(basicFixture);
    await auctionMinter.connect(admin).setAuctionEndTime(await time.latest() + duration);
    await time.increase(duration + 600);
    await expect(placeBid({
      auctionMinter,
      signer: nftManager,
      user: u1,
      bidPrice: "0.5"
    })).to.be.revertedWith("AuctionMinter: auction ended");
  });

});
