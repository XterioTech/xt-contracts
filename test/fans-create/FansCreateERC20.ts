import { Signer } from "ethers";
import hre from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployFansCreateERC20, deployMajorToken } from "../../lib/deploy";
import { signPublishFansCreate } from "../../lib/signature";
import { IERC1155InterfaceID, getInterfaceID } from "../../lib/utils";
import { IAccessControl__factory } from "../../typechain-types";

const URI = "https://api.xter.io/xgc/meta/works/{id}";
const WORK_ID = 222;
const WORK_ID2 = 333;
const PROJECT_ID = 666;
const PRICE_COEF = hre.ethers.parseEther("0.00001");

describe("Test FansCreate Contract", function () {
  async function basicFixture() {
    const [admin, signer, p1, c1, c2, u1, u2, u3] = await hre.ethers.getSigners();
    const paymentToken = await deployMajorToken(admin.address, admin.address);
    const fansCreate = await deployFansCreateERC20(admin.address, URI, paymentToken, PRICE_COEF);
    await fansCreate.grantRole(await fansCreate.SIGNER_ROLE(), signer);
    return {
      fansCreate,
      paymentToken,
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
    const { fansCreate, paymentToken } = await loadFixture(basicFixture);
    expect(await fansCreate.paymentToken()).equal(paymentToken.target);
    expect(await fansCreate.supportsInterface(IERC1155InterfaceID)).equal(true);
    expect(await fansCreate.supportsInterface(getInterfaceID(IAccessControl__factory.createInterface()))).equal(true);

    const c = PRICE_COEF;
    expect(await fansCreate.calcPrice(0, 1)).equal(0);
    expect(await fansCreate.calcPrice(0, 2)).equal(c);
    expect(await fansCreate.calcPrice(1, 1)).equal(c);
    expect(await fansCreate.calcPrice(2, 1)).equal(c * BigInt(2));
    expect(await fansCreate.calcPrice(3, 1)).equal(c * BigInt(3));
    expect(await fansCreate.calcPrice(2, 2)).equal(c * BigInt(2 + 3));
  });

  it("Publish and buy", async function () {
    const { fansCreate, paymentToken, signer, c1, p1 } = await loadFixture(basicFixture);
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
    ).revertedWith("ERC20: insufficient allowance");

    const priceInfo = await fansCreate.getBuyPrice(WORK_ID2, 2);
    await paymentToken.transfer(c1.address, priceInfo.priceAfterFee);
    await paymentToken.connect(c1).approve(fansCreate, priceInfo.priceAfterFee);
    await expect(
      fansCreate
        .connect(c1)
        .publishAndBuyKeys(c1.address, WORK_ID2, 2, PROJECT_ID, deadline, signer.address, signature2)
    ).revertedWith("FansCreateCore: projectFeeRecipient not set");

    await expect(fansCreate.setProjectFeeRecipient(PROJECT_ID, p1.address)).emit(fansCreate, "SetProjectFeeRecipient");
    await fansCreate
      .connect(c1)
      .publishAndBuyKeys(c1.address, WORK_ID2, 2, PROJECT_ID, deadline, signer.address, signature2);
    expect(await paymentToken.balanceOf(p1.address)).equal(priceInfo.price * BigInt(4) / BigInt(100)); // note that before publish, the priceInfo.projectFee would be 0, so we cannot directly refer to it
    expect(await paymentToken.balanceOf(c1.address)).equal(priceInfo.creatorFee);

    await time.setNextBlockTimestamp(deadline + 60);
    await expect(
      fansCreate
        .connect(c1)
        .publishAndBuyKeys(c1.address, WORK_ID2, 2, PROJECT_ID, deadline, signer.address, signature2)
    ).revertedWith("FansCreateCore: deadline exceeded");
  });

    it("Trading", async function () {
      const { fansCreate, paymentToken, c1, u1, u2, u3 } = await loadFixture(publishedWorkFixture);

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
          "ERC20: insufficient allowance"
        );    
        paymentToken.transfer(await user.getAddress(), priceInfo.priceAfterFee)
        await paymentToken.connect(user).approve(fansCreate, priceInfo.priceAfterFee);
        const originalBalance = await paymentToken.balanceOf(await user.getAddress());
        await fansCreate.connect(user).buyKeys(await user.getAddress(), workId, amount, priceInfo.priceAfterFee);
        const afterBalance = await paymentToken.balanceOf(await user.getAddress());
        expect(afterBalance).equal(originalBalance-priceInfo.priceAfterFee);
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
        const originalBalance = await paymentToken.balanceOf(await user.getAddress());
        await fansCreate.connect(user).sellKeys(workId, amount, priceInfo.priceAfterFee);
        const afterBalance = await paymentToken.balanceOf(await user.getAddress());
        expect(afterBalance).equal(originalBalance + priceInfo.priceAfterFee);
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
