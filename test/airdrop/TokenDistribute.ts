
import { expect } from "chai";
import ethers from "ethers";
import hre from "hardhat";
import { deployTokenDistribute, deployMajorToken } from "../../lib/deploy";
import { Distribute } from "../../typechain-types";


describe("TokenDistribute", function () {
  let distribute: Distribute;
  let owner: ethers.Signer;
  let sender: ethers.Signer;
  let recipient1: ethers.Signer;
  let recipient2: ethers.Signer;
  let recipient3: ethers.Signer;

  before(async function () {
    [owner, sender, recipient1, recipient2, recipient3] = await hre.ethers.getSigners();

    distribute = await deployTokenDistribute(await owner.getAddress());
  });

  ///// distribute ERC20 token

  it("should distribute tokens to recipients from sender", async function () {
    // Deploy an ERC20 token contract for testing
    const token = await deployMajorToken(await owner.getAddress(), await owner.getAddress());

    // Mint some tokens to the sender for testing
    await token.connect(owner).transfer(await sender.getAddress(), hre.ethers.parseEther("5000"));

    // Approve the distribute contract to spend tokens on behalf of the sender
    await token.connect(sender).approve(await distribute.getAddress(), hre.ethers.MaxUint256);

    const amounts = [100, 50];
    const recipients = [await recipient1.getAddress(), await recipient2.getAddress()];

    const initialBalances = await Promise.all(
      recipients.map(async (recipient) => {
        return await token.balanceOf(recipient);
      })
    );

    // Distribute tokens to recipients
    await distribute.connect(owner).distributeTokens(
      token.target,
      recipients,
      amounts,
      18, // Decimals of the token
      await sender.getAddress()
    );

    const finalBalances = await Promise.all(
      recipients.map(async (recipient) => {
        return await token.balanceOf(recipient);
      })
    );

    for (let i = 0; i < recipients.length; i++) {
      const amount = amounts[i];
      const initialBalance = initialBalances[i];
      const finalBalance = finalBalances[i];
      expect(finalBalance - initialBalance).to.equal(hre.ethers.parseEther(amount.toString()));
    }
  });


  it("should distribute tokens to recipients from contract", async function () {
    // Deploy an ERC20 token contract for testing
    const token = await deployMajorToken(await owner.getAddress(), await owner.getAddress());

    // Mint some tokens to the contract for testing
    await token.connect(owner).transfer(await distribute.getAddress(), hre.ethers.parseEther("50000000"));

    const amounts = [100, 50, 300000];
    const recipients = [await recipient1.getAddress(), await recipient2.getAddress(), await recipient3.getAddress()];

    const initialBalances = await Promise.all(
      recipients.map(async (recipient) => {
        return await token.balanceOf(recipient);
      })
    );

    // Distribute tokens to recipients
    await distribute.connect(owner).distributeTokens(
      token.target,
      recipients,
      amounts,
      0, // default
      hre.ethers.ZeroAddress // 0x000
    );

    const finalBalances = await Promise.all(
      recipients.map(async (recipient) => {
        return await token.balanceOf(recipient);
      })
    );

    for (let i = 0; i < recipients.length; i++) {
      const amount = amounts[i];
      const initialBalance = initialBalances[i];
      const finalBalance = finalBalances[i];
      expect(finalBalance - initialBalance).to.equal(hre.ethers.parseEther(amount.toString()));
    }

    // should withdraw token successful
    await distribute.connect(owner).withdrawTokens(token.target, await recipient1.getAddress())
    const balance = await hre.ethers.provider.getBalance(await distribute.getAddress());
    expect(balance).to.equal(0);
  });


  ///// distribute ETH

  it("should receive and store ETH", async function () {
    const amount = hre.ethers.parseEther("50");

    await recipient1.sendTransaction({
      to: await distribute.getAddress(),
      value: amount,
    });

    const balance = await hre.ethers.provider.getBalance(await distribute.getAddress());
    expect(balance).to.equal(amount);
  });

  it("should refund ETH to recipients", async function () {
    const amounts = [hre.ethers.parseEther("0.0120182991288433"), hre.ethers.parseEther("0.032768252202011")];
    const recipients = [await recipient1.getAddress(), await recipient2.getAddress()];

    const b1 = await hre.ethers.provider.getBalance(await recipient1.getAddress());
    const b2 = await hre.ethers.provider.getBalance(await recipient2.getAddress());

    await distribute.connect(owner).distributeETH(recipients, amounts);

    const _b1 = await hre.ethers.provider.getBalance(await recipient1.getAddress());
    const _b2 = await hre.ethers.provider.getBalance(await recipient2.getAddress());

    expect(_b1 - b1).to.equal(amounts[0]);
    expect(_b2 - b2).to.equal(amounts[1]);
  });

  it("should allow the owner to withdraw ETH", async function () {
    const init = await hre.ethers.provider.getBalance(await distribute.getAddress())
    expect(init).not.to.equal(0);
    await distribute.connect(owner).withdrawETH();
    const remain = await hre.ethers.provider.getBalance(await distribute.getAddress())
    expect(remain).to.equal(0);
  });

  it("should refund ETH to recipients", async function () {
    const amount = hre.ethers.parseEther("50");
    await recipient1.sendTransaction({
      to: await distribute.getAddress(),
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
    await distribute.connect(owner).distributeETH(recipients, amounts);

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


