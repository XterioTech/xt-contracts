import { ethers } from "hardhat";
import { expect } from "chai";
import { deployMinHeap } from "../../lib/deploy";
import { MinHeap } from "../../typechain-types";

describe("MinHeap", () => {
  let minHeap: MinHeap;

  beforeEach(async () => {
    minHeap = await deployMinHeap()
  });

  it.only("should replace top element when inserting a larger value", async () => {
    await minHeap.insert(5);
    await minHeap.insert(3);
    await minHeap.insert(8);
    await minHeap.insert(1);
    await minHeap.insert(2);

    await minHeap.insert(10);
    const min = await minHeap.getMin();
    expect(min).to.equal(2);
  });

  it.only("should throw an error when trying to extract from an empty heap", async () => {
    await expect(minHeap.extractMin()).to.be.revertedWith("Heap is empty");
  });

  it.only("should extract the minimum value", async () => {
    await minHeap.insert(5);
    await minHeap.insert(3);
    await minHeap.insert(8);
    await minHeap.insert(1);
    await minHeap.insert(2);

    await minHeap.extractMin();
    const newMin = await minHeap.getMin();
    expect(newMin).to.equal(2);
  });
});
