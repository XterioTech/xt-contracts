import ethers from "ethers";
import hre from "hardhat";
import { expect } from "chai";
import { deployRefund } from "../../lib/deploy";

import { Refund } from "../../typechain-types";

describe("Refund", function () {
  let refund: Refund;
  let admin: ethers.Signer;
  let owner: ethers.Signer;;
  let recipient1: ethers.Signer;
  let recipient2: ethers.Signer;

  before(async function () {
    [admin, owner, recipient1, recipient2] = await hre.ethers.getSigners();

    refund = await deployRefund(await owner.getAddress());
  });

  it("should receive and store ETH", async function () {
    const amount = hre.ethers.parseEther("50");

    await recipient1.sendTransaction({
      to: await refund.getAddress(),
      value: amount,
    });

    const balance = await hre.ethers.provider.getBalance(await refund.getAddress());
    expect(balance).to.equal(amount);
  });

  it("should not refund ETH to a contract address", async function () {
    const DummyContract = await hre.ethers.getContractFactory("XterToken");
    const dummyContract = await DummyContract.deploy(admin, admin);
    await dummyContract.waitForDeployment();

    const amount = hre.ethers.parseEther("0.0106526760729166");
    const recipients = [await dummyContract.getAddress()];

    await expect(refund.connect(owner).refund(recipients, [amount])).to.be.revertedWith("Invalid recipient");
  });

  it("should refund ETH to recipients", async function () {
    const amounts = [hre.ethers.parseEther("0.0120182991288433"), hre.ethers.parseEther("0.032768252202011")];
    const recipients = [await recipient1.getAddress(), await recipient2.getAddress()];

    const b1 = await hre.ethers.provider.getBalance(await recipient1.getAddress());
    const b2 = await hre.ethers.provider.getBalance(await recipient2.getAddress());

    await refund.connect(owner).refund(recipients, amounts);

    const _b1 = await hre.ethers.provider.getBalance(await recipient1.getAddress());
    const _b2 = await hre.ethers.provider.getBalance(await recipient2.getAddress());

    expect(_b1 - b1).to.equal(amounts[0]);
    expect(_b2 - b2).to.equal(amounts[1]);
  });

  it("should allow the owner to withdraw ETH", async function () {
    const init = await hre.ethers.provider.getBalance(await refund.getAddress())
    expect(init).not.to.equal(0);
    await refund.connect(owner).withdraw();
    const remain = await hre.ethers.provider.getBalance(await refund.getAddress())
    expect(remain).to.equal(0);
  });

  it("should refund ETH to recipients", async function () {
    const amount = hre.ethers.parseEther("50");
    await recipient1.sendTransaction({
      to: await refund.getAddress(),
      value: amount,
    });

    // 生成随机金额
    function generateRandomAmount() {
      // 生成一个 0.01 到 0.04 之间的随机数
      const randomValue = Math.random() * (0.04 - 0.01) + 0.01;
      const amount = hre.ethers.parseEther(randomValue.toFixed(18));
      return amount;
    }

    // 生成随机地址
    function generateRandomAddress() {
      const wallet = hre.ethers.Wallet.createRandom();
      const address = wallet.address;
      return address;
    }

    const amounts = Array.from({ length: 50 }, generateRandomAmount);
    const recipients = Array.from({ length: 50 }, generateRandomAddress);
    // console.log(amounts);
    // console.log(recipients);

    const initialBalances = await Promise.all(
      recipients.map(async (recipient) => {
        return await hre.ethers.provider.getBalance(recipient);
      })
    );
    // console.log(initialBalances);

    // 调用refund函数
    await refund.connect(owner).refund(recipients, amounts);

    const finalBalances = await Promise.all(
      recipients.map(async (recipient) => {
        return await hre.ethers.provider.getBalance(recipient);
      })
    );
    // console.log(finalBalances);

    for (let i = 0; i < recipients.length; i++) {
      const amount = amounts[i];
      const initialBalance = initialBalances[i];
      const finalBalance = finalBalances[i];
      expect(finalBalance - initialBalance).to.equal(amount);
    }
  });
});
