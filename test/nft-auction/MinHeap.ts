import { ethers } from "hardhat";
import { expect } from "chai";
import { deployMinHeap } from "../../lib/deploy";
import { MinHeap } from "../../typechain-types";

describe("MinHeap", () => {
  let minHeap: MinHeap;

  beforeEach(async () => {
    minHeap = await deployMinHeap()
  });

  it.only("should insert and extract minimum values", async () => {
    await minHeap.insert(5);
    await minHeap.insert(3);
    await minHeap.insert(8);
    await minHeap.insert(1);

    expect(await minHeap.getMin()).to.equal(1);
    expect(await minHeap.extractMin()).to.emit(minHeap, "ExtractedMin").withArgs(1);
    expect(await minHeap.getMin()).to.equal(3);
    expect(await minHeap.extractMin()).to.emit(minHeap, "ExtractedMin").withArgs(3);
    expect(await minHeap.getMin()).to.equal(5);
    expect(await minHeap.extractMin()).to.emit(minHeap, "ExtractedMin").withArgs(5);
    expect(await minHeap.getMin()).to.equal(8);
    expect(await minHeap.extractMin()).to.emit(minHeap, "ExtractedMin").withArgs(8);
  });

  it.only("should throw error when extracting from an empty heap", async () => {
    await expect(minHeap.extractMin()).to.be.revertedWith("Heap is empty");
  });

  // it.only("should return correct minimum value after multiple insertions and extractions", async () => {
  //   await minHeap.insert(10);
  //   await minHeap.insert(5);
  //   await minHeap.insert(15);
  //   await minHeap.insert(2);
  //   await minHeap.insert(7);

  //   expect(await minHeap.getMin()).to.equal(2);
  //   expect(await minHeap.extractMin()).to.equal(2);
  //   expect(await minHeap.getMin()).to.equal(5);
  //   expect(await minHeap.extractMin()).to.equal(5);
  //   expect(await minHeap.getMin()).to.equal(7);
  //   expect(await minHeap.extractMin()).to.equal(7);

  //   await minHeap.insert(3);
  //   await minHeap.insert(1);

  //   expect(await minHeap.getMin()).to.equal(1);
  //   expect(await minHeap.extractMin()).to.equal(1);
  //   expect(await minHeap.getMin()).to.equal(3);
  //   expect(await minHeap.extractMin()).to.equal(3);
  //   expect(await minHeap.getMin()).to.equal(10);
  //   expect(await minHeap.extractMin()).to.equal(10);
  //   expect(await minHeap.getMin()).to.equal(15);
  //   expect(await minHeap.extractMin()).to.equal(15);
  // });
});
