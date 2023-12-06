import { ethers } from "hardhat";
import { expect } from "chai";
import { deployMinHeapAuction } from "../../lib/deploy";
import { MinHeapAuction } from "../../typechain-types";

describe("MinHeapAuction", () => {
  let minHeapAuction: MinHeapAuction;

  beforeEach(async () => {
    minHeapAuction = await deployMinHeapAuction()
  });

  it.only("should insert and retrieve the minimum auction", async function () {
    const auction1 = { price: 100, timestamp: Math.floor(Date.now() / 1000) };
    const auction2 = { price: 200, timestamp: Math.floor(Date.now() / 1000) };
    const auction3 = { price: 50, timestamp: Math.floor(Date.now() / 1000) };

    await minHeapAuction.insert(auction1);
    await minHeapAuction.insert(auction2);
    await minHeapAuction.insert(auction3);

    const minAuction = await minHeapAuction.getMin();
    expect(minAuction.price).to.equal(50);
  });

  it.only("should extract minimum auction", async function () {
    const auction1 = { price: 100, timestamp: 1 };
    const auction2 = { price: 200, timestamp: 2 };
    const auction3 = { price: 50, timestamp: 3 };
    const auction4 = { price: 300, timestamp: 4 };
    const auction5 = { price: 150, timestamp: 5 };

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
});
