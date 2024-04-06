import hre from "hardhat";
import ethers from "ethers";
import { expect } from "chai";
import { deployDepositMinter } from "../../lib/deploy";
import { DepositMinter } from "../../typechain-types";
import { nftTradingTestFixture } from "../common_fixtures";
import { loadFixture, mine, setBalance, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const initialStartTime = 1903490000;
const initialEndTime = 1903490000;
const duration = 3600;
const nftCount = 10;
const nftCountLarge = 300;

const deposit = async ({
  depositMinter,
  user,
}: {
  depositMinter: DepositMinter;
  user: ethers.Signer;
}) => {
  return depositMinter.connect(user).deposit({ value: hre.ethers.parseEther('0.01') });
};

const randomUser = async () => {
  const wallet = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  await setBalance(wallet.address, hre.ethers.parseEther("100"));
  return wallet;
};

async function fixtureWithNFTCount(cnt: number) {
  const base = await nftTradingTestFixture();
  const [, , , admin, paymentReceiver, u1, u2] = await hre.ethers.getSigners();

  const gatewayAddress = await base.gateway.getAddress();
  const nftAddress = await base.erc721.getAddress();

  const depositMinter = await deployDepositMinter(
    admin.address,
    gatewayAddress,
    nftAddress,
    paymentReceiver.address,
    initialStartTime,
    initialEndTime,
    hre.ethers.parseEther('0.01')
  )

  await base.gateway.connect(base.gatewayAdmin).addOperatorWhitelist(await depositMinter.getAddress());
  expect(await base.gateway.nftManager(nftAddress)).equal(base.nftManager.address, "nftManager matched");

  await depositMinter.connect(admin).setAuctionStartTime((await time.latest()));
  await depositMinter.connect(admin).setAuctionEndTime((await time.latest()) + duration);

  return {
    ...base,
    depositMinter,
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

describe("DepositMinter Deposit", function () {
  it("should deposit", async function () {
    const { depositMinter, admin, nftManager, u1 } = await loadFixture(basicFixture);
    expect(await depositMinter.getBidAmtByBuyerId(u1.address)).to.equal(0);

    await deposit({ depositMinter, user: u1 })

    const userBid = await depositMinter.userBids(u1.address, 0);
    expect(userBid[1]).to.equal(u1.address);

    expect(depositMinter.connect(u1).claimAndRefund()).to.be.revertedWith(
      "DepositMinter: No claims or refunds allowed until auction ends"
    );
    expect(depositMinter.sendPayment()).to.be.revertedWith(
      "DepositMinter: payment can only be made after the auction has ended"
    );
    expect(await depositMinter.getBidAmtByBuyerId(u1.address)).to.equal(1);
    const bids = await depositMinter.getUserBids([u1.address])
    expect(bids.length).equal(1);
    expect(bids[0][0][1]).equal(u1.address);
  });

  it("should not deposit if auction has not started", async function () {
    const { depositMinter, admin, nftManager, u1 } = await loadFixture(basicFixture);

    await depositMinter.connect(admin).setAuctionStartTime((await time.latest()) + duration);
    await expect(
      deposit({ depositMinter, user: u1 })
    ).to.be.revertedWith("DepositMinter: deposit time invalid");
  });

  it("cannot perform claimInfo operation until the auction ends", async function () {
    const { depositMinter, admin, nftManager, u1 } = await loadFixture(basicFixture);
    await expect(
      depositMinter.getUserClaimInfos([u1.address])
    ).to.be.revertedWith("DepositMinter: No claimInfo allowed until auction ends");
  });

  it("should not deposit if auction has ended", async function () {
    const { depositMinter, admin, nftManager, u1 } = await loadFixture(basicFixture);

    await time.increase(duration + 600);
    await expect(
      deposit({ depositMinter, user: u1 })
    ).to.be.revertedWith("DepositMinter: deposit time invalid");
  });

  it("should not deposit if maximum deposit per user is reached", async function () {
    const { depositMinter, admin, nftManager, u1, u2 } = await loadFixture(basicFixture);
    await deposit({ depositMinter, user: u1 })
    await expect(deposit({ depositMinter, user: u1 })).to.be.revertedWith("DepositMinter: buyer limit exceeded");
  });
});

describe("DepositMinter Claim", function () {
  it("normal claim", async function () {
    const { depositMinter, admin, erc721, nftManager, u1 } = await loadFixture(basicFixture);

    // deposit 
    const users = [];
    for (let i = 0; i < nftCount + 1; i++) {
      const u = await randomUser();
      users.push(u);
      await deposit({ depositMinter, user: u })
    }

    // set nftCount after auction ended
    await depositMinter.connect(admin).setNftAmount(nftCount)
    // increase timestamp to auction ended
    await time.increase(duration + 600);

    expect(await depositMinter.tvl()).equal(hre.ethers.parseEther((0.01 * (nftCount + 1)).toString()));
    expect(await depositMinter.getTotalBidsCnt()).equal(nftCount + 1);
    expect(depositMinter.connect(u1).claimAndRefund()).to.be.revertedWith("DepositMinter: nothing to claim");

    const claimInfos = await depositMinter.getUserClaimInfos(users.map((u) => u.address));
    for (let i = 0; i < nftCount; i++) {
      const claimInfo = claimInfos[i];
      expect(claimInfo.hasClaimed).equal(false);
      expect(claimInfo.nftCount).equal(1);
      expect(claimInfo.refundAmount).equal(0);
      await depositMinter.connect(users[i]).claimAndRefund();
      expect(await erc721.balanceOf(users[i])).equal(1);
      expect((await depositMinter.claimInfo(users[i].address)).hasClaimed).equal(true);
      expect(depositMinter.claimInfo(users[i].address)).to.be.revertedWith("DepositMinter: has claimed");
    }

    const claimInfo = await depositMinter.claimInfo(users[nftCount].address);
    expect(claimInfo.hasClaimed).equal(false);
    expect(claimInfo.nftCount).equal(0);
    expect(claimInfo.refundAmount).equal(hre.ethers.parseEther("0.01"));
    await depositMinter.connect(users[nftCount]).claimAndRefund();

    await depositMinter.connect(admin).setRecipient(u1.address);
    const oldBalance = await hre.ethers.provider.getBalance(u1.address);
    await depositMinter.sendPayment();
    const newBalance = await hre.ethers.provider.getBalance(u1.address);
    const finalPrice = hre.ethers.parseEther("0.01");
    expect(newBalance - oldBalance).equal(finalPrice * BigInt(nftCount));
  });
});

describe("DepositMinter Management", function () {
  it("should have valid access control", async function () {
    const { depositMinter, gateway, admin, u1, u2, erc721 } = await loadFixture(basicFixture);
    // set gateway
    expect(depositMinter.setGateway(gateway.target)).to.be.reverted;
    await depositMinter.connect(admin).setGateway(gateway.target);
    // set payment receiver
    expect(depositMinter.setRecipient(u1.address)).to.be.reverted;
    await depositMinter.connect(admin).setRecipient(u1.address);

    await depositMinter.connect(admin).grantRole(await depositMinter.MANAGER_ROLE(), u2.address);
    // set nft address
    expect(depositMinter.setNftAddress(erc721.target)).to.be.reverted;
    await depositMinter.connect(u2).setNftAddress(erc721.target);

    // set limit for buyer amount
    expect(depositMinter.setLimitForBuyerAmount(2)).to.be.reverted;
    await depositMinter.connect(admin).setLimitForBuyerAmount(2);

    // set auction end time
    expect(depositMinter.setAuctionEndTime((await time.latest()) + 600)).to.be.reverted;
    expect(depositMinter.connect(u2).setAuctionEndTime((await time.latest()) - 600)).to.be.revertedWith(
      "DepositMinter: invalid timestamp"
    );
    await depositMinter.connect(u2).setAuctionEndTime((await time.latest()) + 600);
    time.setNextBlockTimestamp((await time.latest()) + 600);
    expect(depositMinter.connect(u2).setAuctionEndTime((await time.latest()) + 600)).to.be.revertedWith(
      "DepositMinter: already ended"
    );
  });
});

describe("DepositMinter Large Dataset", function () {
  this.timeout(14400000);

  it.skip("large number of deposits", async function () {
    const { depositMinter, admin, erc721, nftManager, paymentReceiver } = await loadFixture(largeFixture);

    const users = [];
    const totalBids = Math.floor(nftCountLarge * 1.1);
    for (let i = 0; i < totalBids; i++) {
      const u = await randomUser();
      users.push(u);
      if (i % 100 === 99 || i == totalBids - 1) {
        console.log(`generating users ${i + 1} / ${totalBids}`);
      }
    }
    console.log("users generated");

    // refer to https://stackoverflow.com/questions/72497597/how-to-make-local-hardhat-network-run-faster
    // enable manual mining
    await hre.network.provider.send("evm_setAutomine", [false]);
    await hre.network.provider.send("evm_setIntervalMining", [0]);

    console.log("large # of deposit now");
    let numPlaced = 0;
    const afterDeposited = async () => {
      numPlaced++;
      if (numPlaced % 10 == 0 || numPlaced == totalBids) {
        console.log(`depositing ${numPlaced} / ${totalBids}`);
        await mine(1);
      }
    };

    for (let i = 0; i < totalBids; i++) {
      await deposit({ depositMinter, user: users[i] })
      await afterDeposited();
    }

    while (await depositMinter.getTotalBidsCnt() < totalBids) {
      await mine(10);
      console.log(`minted: ${await depositMinter.getTotalBidsCnt()}`)
    }

    // re-enable automining when you are done, so you dont need to manually mine future blocks
    await hre.network.provider.send("evm_setAutomine", [true]);

    console.log("all deposit done!!!!");

    // set nftCount after auction ended
    await depositMinter.connect(admin).setNftAmount(nftCountLarge)
    // increase timestamp to auction ended
    await time.increase(duration * 1000 + 600);


    expect(await depositMinter.getTotalBidsCnt()).equal(totalBids);
    const finalPrice = hre.ethers.parseEther('0.01');

    for (let i = 0; i < totalBids; i++) {
      const claimInfo = await depositMinter.claimInfo(users[i].address);
      expect(claimInfo.hasClaimed).equal(false);
      if (i < nftCountLarge) {
        expect(claimInfo.refundAmount).equal(0);
        expect(claimInfo.nftCount).equal(1);
      } else {
        expect(claimInfo.refundAmount).equal(finalPrice);
        expect(claimInfo.nftCount).equal(0);
      }
      if (i % 100 == 99) {
        console.log(`checking claim info ${i + 1} / ${totalBids}`);
        await depositMinter.connect(users[i]).claimAndRefund();
        expect(await erc721.balanceOf(users[i])).equal(claimInfo.nftCount);
      }
    }

    const oldBalance = await hre.ethers.provider.getBalance(paymentReceiver.address);
    await depositMinter.sendPayment();
    const newBalance = await hre.ethers.provider.getBalance(paymentReceiver.address);
    expect(newBalance - oldBalance).equal(finalPrice * BigInt(nftCountLarge));
  });
});
