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

    expect(
      fansCreate.connect(c1).publishAndBuyKeys(c1.address, WORK_ID2, 2, PROJECT_ID, deadline, signer.address, signature)
    ).revertedWith("FansCreateCore: invalid signature");
    const signature2 = await signPublish(signer, c1.address, WORK_ID2, PROJECT_ID, deadline, fansCreate.target);
    await expect(
      fansCreate
        .connect(c1)
        .publishAndBuyKeys(c1.address, WORK_ID2, 2, PROJECT_ID, deadline, signer.address, signature2)
    ).revertedWith("FansCreate: insufficient payment");
    const priceInfo = await fansCreate.getBuyPrice(WORK_ID2, 2);
    await fansCreate
      .connect(c1)
      .publishAndBuyKeys(c1.address, WORK_ID2, 2, PROJECT_ID, deadline, signer.address, signature2, {
        value: priceInfo[1],
      });
  });
});
