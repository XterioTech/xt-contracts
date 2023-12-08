import hre from "hardhat";
import { expect } from "chai";
import { deployMinHeapAuction } from "../../lib/deploy";
import { MinHeapAuction } from "../../typechain-types";

describe("MinHeapAuction", () => {
  let bidder = "0x0000000000000000000000000000000000000000";
  let minHeapAuction: MinHeapAuction;
  beforeEach(async () => {
    const MAX_CAPACITY = 5;
    minHeapAuction = await deployMinHeapAuction(MAX_CAPACITY)
  });

  it("should insert and retrieve the minimum auction", async function () {
    const auction1 = { bidder, price: 100, timestamp: Math.floor(Date.now() / 1000) };
    const auction2 = { bidder, price: 200, timestamp: Math.floor(Date.now() / 1000) };
    const auction3 = { bidder, price: 50, timestamp: Math.floor(Date.now() / 1000) };

    await minHeapAuction.insert(auction1);
    await minHeapAuction.insert(auction2);
    await minHeapAuction.insert(auction3);

    const minAuction = await minHeapAuction.getMin();
    expect(minAuction.price).to.equal(50);
  });

  it("should extract minimum auction", async function () {
    const auction1 = { bidder, price: 100, timestamp: 1 };
    const auction2 = { bidder, price: 200, timestamp: 2 };
    const auction3 = { bidder, price: 50, timestamp: 3 };
    const auction4 = { bidder, price: 300, timestamp: 4 };
    const auction5 = { bidder, price: 150, timestamp: 5 };

    await minHeapAuction.insert(auction1);
    await minHeapAuction.insert(auction2);
    await minHeapAuction.insert(auction3);
    await minHeapAuction.insert(auction4);
    await minHeapAuction.insert(auction5);

    await minHeapAuction.extractMin()
    await minHeapAuction.extractMin()
    await minHeapAuction.extractMin()

    const minAuction = await minHeapAuction.getMin()
    expect(minAuction.price).to.equal(auction2.price);
    expect(minAuction.timestamp).to.equal(auction2.timestamp);
  });

  it("should reject insertion when heap is full and value is larger", async function () {
    const auction1 = { bidder, price: 100, timestamp: 1 };
    const auction2 = { bidder, price: 200, timestamp: 2 };
    const auction3 = { bidder, price: 50, timestamp: 3 };
    const auction4 = { bidder, price: 300, timestamp: 4 };
    const auction5 = { bidder, price: 150, timestamp: 5 };
    await minHeapAuction.insert(auction1);
    await minHeapAuction.insert(auction2);
    await minHeapAuction.insert(auction3);
    await minHeapAuction.insert(auction4);
    await minHeapAuction.insert(auction5);

    const auction6 = { bidder, price: 10, timestamp: 6 };
    await expect(minHeapAuction.insert(auction6)).to.be.revertedWith("Heap is full, value to be inserted should be smaller");
  });

  it("should handle large number of auctions with same price", async function () {
    const auction2 = { bidder, price: 200, timestamp: 2 };
    const auction3 = { bidder, price: 50, timestamp: 3 };
    const auction4 = { bidder, price: 300, timestamp: 4 };
    await minHeapAuction.insert(auction2);
    await minHeapAuction.insert(auction3);
    await minHeapAuction.insert(auction4);
    await minHeapAuction.insert(auction4);
    await minHeapAuction.insert(auction4);

    const auction = { bidder, price: 100, timestamp: Math.floor(Date.now() / 1000) };
    await minHeapAuction.insert(auction);
    for (let i = 0; i < 100; i++) {
      await expect(minHeapAuction.insert(auction)).to.be.revertedWith("Heap is full, value to be inserted should be smaller");
    }
  });
});
