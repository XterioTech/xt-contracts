import { Signer } from "ethers";
import hre from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFansCreate } from "../../lib/deploy";
import { signPublishFansCreate } from "../../lib/signature";
import { IERC1155InterfaceID, getInterfaceID } from "../../lib/utils";
import { IAccessControl__factory } from "../../typechain-types";

const URI = "https://api.xter.io/xgc/meta/works/{id}";
const WORK_ID = 123;
const WORK_ID2 = 456;
const PROJECT_ID = 666;
describe("Test FansCreate Contract", function () {
  async function basicFixture() {
    const [admin, signer, p1, c1, c2, u1, u2, u3] = await hre.ethers.getSigners();
    const fansCreate = await deployFansCreate(admin.address, signer.address, admin.address, URI);
    return {
      fansCreate,
      admin,
      signer,
      p1,
      c1,
      c2,
      u1,
      u2,
      u3,
    };
  }

  async function publishedWorkFixture() {
    const base = await loadFixture(basicFixture);
    const { fansCreate, signer, c1, p1 } = base;
    const deadline = (await time.latest()) + 600;
    const signature = await signPublishFansCreate(signer, c1.address, WORK_ID, PROJECT_ID, deadline, fansCreate.target);
    await fansCreate.setProjectFeeRecipient(PROJECT_ID, p1.address);
    await fansCreate
      .connect(c1)
      .publishAndBuyKeys(c1.address, WORK_ID, 1, PROJECT_ID, deadline, signer.address, signature);
    const signature2 = await signPublishFansCreate(signer, c1.address, WORK_ID2, 0, deadline, fansCreate.target);
    await fansCreate.connect(c1).publishAndBuyKeys(c1.address, WORK_ID2, 1, 0, deadline, signer.address, signature2);
    return base;
  }

  it("Basic info", async function () {
    const { fansCreate } = await loadFixture(basicFixture);
    expect(await fansCreate.paymentToken()).equal(hre.ethers.ZeroAddress);
    expect(await fansCreate.supportsInterface(IERC1155InterfaceID)).equal(true);
    expect(await fansCreate.supportsInterface(getInterfaceID(IAccessControl__factory.createInterface()))).equal(true);

    const c = hre.ethers.parseEther("0.0002");
    expect(await fansCreate.calcPrice(0, 1)).equal(0);
    expect(await fansCreate.calcPrice(0, 2)).equal(c);
    expect(await fansCreate.calcPrice(1, 1)).equal(c);
    expect(await fansCreate.calcPrice(2, 1)).equal(c * BigInt(2));
    expect(await fansCreate.calcPrice(3, 1)).equal(c * BigInt(3));
    expect(await fansCreate.calcPrice(2, 2)).equal(c * BigInt(2 + 3));
  });

  it("Publish and buy", async function () {
    const { fansCreate, signer, c1, p1 } = await loadFixture(basicFixture);
    const deadline = (await time.latest()) + 600;
    const signature = await signPublishFansCreate(signer, c1.address, WORK_ID, PROJECT_ID, deadline, fansCreate.target);
    await expect(
      fansCreate.connect(c1).publishAndBuyKeys(c1.address, WORK_ID, 1, PROJECT_ID, deadline, signer.address, signature)
    )
      .emit(fansCreate, "Publish")
      .emit(fansCreate, "Trade")
      .emit(fansCreate, "DistributeFee");
    expect(await fansCreate.uri(WORK_ID)).to.equal(URI);
    expect(await fansCreate.totalSupply(WORK_ID)).equal(1);

    expect(
      fansCreate.connect(c1).publishAndBuyKeys(c1.address, WORK_ID2, 1, 0, deadline, signer.address, signature)
    ).revertedWith("FansCreateCore: invalid signature");

    const signature2 = await signPublishFansCreate(
      signer,
      c1.address,
      WORK_ID2,
      PROJECT_ID,
      deadline,
      fansCreate.target
    );
    await expect(
      fansCreate
        .connect(c1)
        .publishAndBuyKeys(c1.address, WORK_ID2, 2, PROJECT_ID, deadline, signer.address, signature2)
    ).revertedWith("FansCreate: insufficient payment");

    const priceInfo = await fansCreate.getBuyPrice(WORK_ID2, 2);
    await expect(
      fansCreate
        .connect(c1)
        .publishAndBuyKeys(c1.address, WORK_ID2, 2, PROJECT_ID, deadline, signer.address, signature2, {
          value: priceInfo.priceAfterFee,
        })
    ).revertedWith("FansCreateCore: projectFeeRecipient not set");

    await expect(fansCreate.setProjectFeeRecipient(PROJECT_ID, p1.address)).emit(fansCreate, "SetProjectFeeRecipient");
    await fansCreate
      .connect(c1)
      .publishAndBuyKeys(c1.address, WORK_ID2, 2, PROJECT_ID, deadline, signer.address, signature2, {
        value: priceInfo.priceAfterFee,
      });

    await time.setNextBlockTimestamp(deadline + 60);
    await expect(
      fansCreate
        .connect(c1)
        .publishAndBuyKeys(c1.address, WORK_ID2, 2, PROJECT_ID, deadline, signer.address, signature2)
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

  it("Management operations", async function () {
    const { fansCreate, c1, u1, u2, u3 } = await loadFixture(publishedWorkFixture);

    await expect(fansCreate.connect(c1).setURI("abc")).reverted;
    await fansCreate.setURI("abc");

    await expect(fansCreate.connect(c1).safeTransferFrom(c1.address, u1.address, WORK_ID, 1, "0x")).revertedWith(
      "FansCreateCore: transfer not allowed"
    );
    await expect(fansCreate.connect(c1).setTransferWhitelisted(c1.address, true)).reverted;
    await fansCreate.setTransferWhitelisted(c1.address, true);
    await fansCreate.connect(c1).safeTransferFrom(c1.address, u1.address, WORK_ID, 1, "0x");
    await fansCreate.connect(u1).safeTransferFrom(u1.address, c1.address, WORK_ID, 1, "0x");

    await expect(fansCreate.connect(c1).setFeeRatio(500, 500, 500)).reverted;
    await expect(fansCreate.setFeeRatio(500, 500, 500)).emit(fansCreate, "SetFeeRatio");

    await expect(fansCreate.connect(c1).setProjectFeeRecipient(PROJECT_ID, c1.address)).reverted;
    await fansCreate.setProjectFeeRecipient(PROJECT_ID, c1.address);
    expect(await fansCreate.projectFeeRecipient(PROJECT_ID)).equal(c1.address);

    await expect(fansCreate.connect(c1).setProtocolFeeRecipient(c1.address)).reverted;
    await fansCreate.setProtocolFeeRecipient(c1.address);
    expect(await fansCreate.protocolFeeRecipient()).equal(c1.address);

    await expect(fansCreate.connect(c1).setWorkProjectId(WORK_ID, 1)).reverted;
    await fansCreate.setWorkProjectId(WORK_ID, 1);
    expect(await fansCreate.workProjectId(WORK_ID)).equal(1);
  });
});
