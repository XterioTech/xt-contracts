import { Signer } from "ethers";
import hre from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFansCreate } from "../../lib/deploy";
import { AddressLike, BigNumberish } from "ethers";

const signPublish = async (
  signer: Signer,
  creator: AddressLike,
  workId: BigNumberish,
  projectId: BigNumberish,
  deadline: BigNumberish,
  contractAddress: AddressLike
) => {
  const msgHash = hre.ethers.solidityPackedKeccak256(
    [
      "address", // creator
      "uint256", // workId
      "uint256", // projectId
      "uint256", // deadline
      "uint256", // chainid
      "address", // contract address
    ],
    [creator, workId, projectId, deadline, hre.network.config.chainId, contractAddress]
  );
  return await signer.signMessage(hre.ethers.getBytes(msgHash));
};

const URI = "https://api.xter.io/xgc/meta/works/{id}";
const WORK_ID = 123;
const WORK_ID2 = 456;
const PROJECT_ID = 666;
describe("Test FansCreate Contract", function () {
  async function basicFixture() {
    const [admin, signer, c1, c2, u1, u2, u3] = await hre.ethers.getSigners();
    const fansCreate = await deployFansCreate(admin.address, URI);
    await fansCreate.grantRole(await fansCreate.SIGNER_ROLE(), signer);
    return {
      fansCreate,
      admin,
      signer,
      c1,
      c2,
      u1,
      u2,
      u3,
    };
  }

  async function publishedWorkFixture() {
    const base = await loadFixture(basicFixture);
    const { fansCreate, signer, c1 } = base;
    const deadline = (await time.latest()) + 600;
    const signature = await signPublish(signer, c1.address, WORK_ID, PROJECT_ID, deadline, fansCreate.target);
    await fansCreate
      .connect(c1)
      .publishAndBuyKeys(c1.address, WORK_ID, 1, PROJECT_ID, deadline, signer.address, signature);
    const signature2 = await signPublish(signer, c1.address, WORK_ID2, 0, deadline, fansCreate.target);
    await fansCreate.connect(c1).publishAndBuyKeys(c1.address, WORK_ID2, 1, 0, deadline, signer.address, signature2);
    return base;
  }

  it("Basic info", async function () {
    const { fansCreate } = await loadFixture(basicFixture);
    expect(await fansCreate.paymentToken()).equal(hre.ethers.ZeroAddress);
    const c = hre.ethers.parseEther("0.0008");
    expect(await fansCreate.calcPrice(0, 1)).equal(0);
    expect(await fansCreate.calcPrice(0, 2)).equal(c);
    expect(await fansCreate.calcPrice(1, 1)).equal(c);
    expect(await fansCreate.calcPrice(2, 1)).equal(c * BigInt(2 * 2));
    expect(await fansCreate.calcPrice(3, 1)).equal(c * BigInt(3 * 3));
    expect(await fansCreate.calcPrice(2, 2)).equal(c * BigInt(2 * 2 + 3 * 3));
  });

  it("Publish and buy", async function () {
    const { fansCreate, signer, c1 } = await loadFixture(basicFixture);
    const deadline = (await time.latest()) + 600;
    const signature = await signPublish(signer, c1.address, WORK_ID, PROJECT_ID, deadline, fansCreate.target);
    await expect(
      fansCreate.connect(c1).publishAndBuyKeys(c1.address, WORK_ID, 1, PROJECT_ID, deadline, signer.address, signature)
    )
      .emit(fansCreate, "Publish")
      .emit(fansCreate, "Trade")
      .emit(fansCreate, "DistributeFee");
    expect(await fansCreate.uri(WORK_ID)).to.equal(URI);
    expect(await fansCreate.totalSupply(WORK_ID)).equal(1);

    expect(
      fansCreate.connect(c1).publishAndBuyKeys(c1.address, WORK_ID2, 2, 0, deadline, signer.address, signature)
    ).revertedWith("FansCreateCore: invalid signature");

    const signature2 = await signPublish(signer, c1.address, WORK_ID2, 0, deadline, fansCreate.target);
    await expect(
      fansCreate.connect(c1).publishAndBuyKeys(c1.address, WORK_ID2, 2, 0, deadline, signer.address, signature2)
    ).revertedWith("FansCreate: insufficient payment");

    const priceInfo = await fansCreate.getBuyPrice(WORK_ID2, 2);
    await fansCreate.connect(c1).publishAndBuyKeys(c1.address, WORK_ID2, 2, 0, deadline, signer.address, signature2, {
      value: priceInfo[1],
    });

    await time.setNextBlockTimestamp(deadline + 60);
    await expect(
      fansCreate.connect(c1).publishAndBuyKeys(c1.address, WORK_ID2, 2, 0, deadline, signer.address, signature2)
    ).revertedWith("FansCreateCore: deadline exceeded");
  });

  it("Trading", async function () {
    const { fansCreate, c1, u1, u2, u3 } = await loadFixture(publishedWorkFixture);

    await expect(fansCreate.buyKeys(await u1.getAddress(), 888, 1, 0)).revertedWith(
      "FansCreateCore: work not published yet"
    );

    const buyCase = async (user: Signer, workId: number, projectId: number, amount: number) => {
      const priceInfo = await fansCreate.getBuyPrice(workId, amount);
      expect(priceInfo.projectId).equal(projectId);
      expect(priceInfo.price + priceInfo.creatorFee + priceInfo.projectFee + priceInfo.protocolFee).equal(
        priceInfo.priceAfterFee
      );
      if (projectId == 0) {
        expect(priceInfo.projectFee).equal(0);
      }
      await expect(fansCreate.buyKeys(await user.getAddress(), workId, amount, priceInfo.price)).revertedWith(
        "FansCreateCore: price limit exceeded"
      );
      await expect(fansCreate.buyKeys(await user.getAddress(), workId, amount, priceInfo.priceAfterFee)).revertedWith(
        "FansCreate: insufficient payment"
      );
      await fansCreate.connect(user).buyKeys(await user.getAddress(), workId, amount, priceInfo.priceAfterFee, {
        value: priceInfo.priceAfterFee,
      });
    };

    const sellCase = async (user: Signer, workId: number, projectId: number, amount: number) => {
      const priceInfo = await fansCreate.getSellPrice(workId, amount);
      expect(priceInfo.projectId).equal(projectId);
      expect(priceInfo.price - priceInfo.creatorFee - priceInfo.projectFee - priceInfo.protocolFee).equal(
        priceInfo.priceAfterFee
      );
      if (projectId == 0) {
        expect(priceInfo.projectFee).equal(0);
      }
      if (priceInfo.price > 0) {
        await expect(fansCreate.connect(user).sellKeys(workId, amount, priceInfo.price)).revertedWith(
          "FansCreateCore: price limit exceeded"
        );
      }
      await fansCreate.connect(user).sellKeys(workId, amount, priceInfo.priceAfterFee);
    };

    await buyCase(u1, WORK_ID, PROJECT_ID, 1);
    await buyCase(u2, WORK_ID, PROJECT_ID, 1);
    await buyCase(u3, WORK_ID, PROJECT_ID, 10);
    await buyCase(u1, WORK_ID2, 0, 10);

    await sellCase(u1, WORK_ID, PROJECT_ID, 1);
    await sellCase(u3, WORK_ID, PROJECT_ID, 5);
    await sellCase(u2, WORK_ID, PROJECT_ID, 1);
    await sellCase(u3, WORK_ID, PROJECT_ID, 5);
    await sellCase(u1, WORK_ID2, 0, 10);

    // sell the last key
    await sellCase(c1, WORK_ID, PROJECT_ID, 1);
  });

});
