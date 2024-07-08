import hre, { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployOnchainIAP, deployMajorToken } from "../../lib/deploy";

describe("OnchainIAP", function () {
  async function basicFixture() {
    const [owner, vault, manager, user] = await hre.ethers.getSigners();
    const onchainIAP = await deployOnchainIAP(owner.address);
    const paymentToken = await deployMajorToken(vault.address, vault.address);
    const paymentTokenAddress = await paymentToken.getAddress()

    await onchainIAP.grantRole(await onchainIAP.MANAGER_ROLE(), manager.address);

    return {
      onchainIAP,
      paymentToken,
      paymentTokenAddress,
      owner,
      vault,
      manager,
      user
    };
  }

  describe("Product Management", function () {
    it("Should register a new product", async function () {
      const { onchainIAP, owner } = await loadFixture(basicFixture);
      await onchainIAP.registerProduct(1, 18, owner.address);
      const [priceDecimals, paymentRecipient] = await onchainIAP.getProductInfo(1);
      expect(priceDecimals).to.equal(18);
      expect(paymentRecipient).to.equal(owner.address);
    });

    it("Should disable a product", async function () {
      const { onchainIAP, owner, manager } = await loadFixture(basicFixture);
      await onchainIAP.registerProduct(1, 18, owner.address);
      await onchainIAP.connect(manager).setDisableProduct(1, true);
      const p = await onchainIAP.products(1);
      expect(p.disabled).to.be.true;

    });
  });

  describe("SKU Management", function () {
    it("Should register a new SKU", async function () {
      const { onchainIAP, owner } = await loadFixture(basicFixture);
      await onchainIAP.registerProduct(1, 18, owner.address);
      await onchainIAP.registerSKU(1, 1, ethers.parseEther("1"), 100);
      const [amount, disabled, price] = await onchainIAP.getProductSKUInfo(1, 1);
      expect(amount).to.equal(100);
      expect(disabled).to.be.false;
      expect(price).to.equal(ethers.parseEther("1"));
    });

    it("Should disable an SKU", async function () {
      const { onchainIAP, owner, manager } = await loadFixture(basicFixture);
      await onchainIAP.registerProduct(1, 18, owner.address);
      await onchainIAP.registerSKU(1, 1, ethers.parseEther("1"), 100);
      await onchainIAP.connect(manager).setDisableSKU(1, 1, true);
      const [, disabled] = await onchainIAP.getProductSKUInfo(1, 1);
      expect(disabled).to.be.true;
    });
  });

  describe("Payment Method Management", function () {
    it("Should register a new payment method", async function () {
      const { onchainIAP, paymentToken, owner, paymentTokenAddress } = await loadFixture(basicFixture);
      await onchainIAP.registerProduct(1, 18, owner.address);
      await onchainIAP.registerPaymentMethod(1, paymentTokenAddress, true, 100, 1, ethers.ZeroAddress, ethers.ZeroAddress);
      const [valid, isFixedRate, numerator, denominator, numeratorOracle, denominatorOracle] = await onchainIAP.getProductPaymentMethodInfo(1, paymentTokenAddress);
      expect(valid).to.be.true;
      expect(isFixedRate).to.be.true;
      expect(numerator).to.equal(100);
      expect(denominator).to.equal(1);
      expect(numeratorOracle).to.equal(ethers.ZeroAddress);
      expect(denominatorOracle).to.equal(ethers.ZeroAddress);
    });
  });

  describe("Purchase with ERC20 FixedRate", function () {
    it("Should successfully purchase an SKU", async function () {
      const { onchainIAP, paymentToken, owner, user, vault, paymentTokenAddress } = await loadFixture(basicFixture);
      await onchainIAP.registerProduct(1, 0, owner.address);
      await onchainIAP.registerSKU(1, 1, ethers.parseEther("1"), 100);
      await onchainIAP.registerPaymentMethod(1, paymentTokenAddress, true, 1, 1, ethers.ZeroAddress, ethers.ZeroAddress);
      await paymentToken.connect(vault).transfer(user.address, ethers.parseEther("10"));
      await paymentToken.connect(user).approve(await onchainIAP.getAddress(), ethers.parseEther("10"));

      await expect(onchainIAP.connect(user).purchaseSKU(1, 1, paymentTokenAddress))
        .to.emit(onchainIAP, "PurchaseSuccess")
        .withArgs(user.address, 1, 1, paymentTokenAddress, ethers.parseEther("1"), 100);
    });

    it("Should fail to purchase a disabled SKU", async function () {
      const { onchainIAP, paymentToken, owner, vault, manager, user, paymentTokenAddress } = await loadFixture(basicFixture);
      await onchainIAP.registerProduct(1, 18, owner.address);
      await onchainIAP.registerSKU(1, 1, ethers.parseEther("1"), 100);
      await onchainIAP.registerPaymentMethod(1, paymentTokenAddress, true, 1, 1, ethers.ZeroAddress, ethers.ZeroAddress);
      await paymentToken.connect(vault).transfer(user.address, ethers.parseEther("10"));
      await paymentToken.connect(user).approve(await onchainIAP.getAddress(), ethers.parseEther("10"));
      await onchainIAP.connect(manager).setDisableSKU(1, 1, true);
      await expect(onchainIAP.connect(user).purchaseSKU(1, 1, paymentTokenAddress))
        .to.be.revertedWith("OnchainIAP: SKU disabled");
    });
  });

  describe("Purchase with ETH FixedRate", function () {
    it("Should successfully purchase an SKU using ETH", async function () {
      const { onchainIAP, owner, user } = await loadFixture(basicFixture);
      const productId = 1;
      const skuId = 1;
      const ethPrice = ethers.parseEther("0.1"); // 0.1 ETH

      // Register product and SKU
      await onchainIAP.registerProduct(productId, 18, owner.address);
      await onchainIAP.registerSKU(productId, skuId, ethPrice, 100);

      // Register ETH as a payment method (address(0) represents ETH)
      await onchainIAP.registerPaymentMethod(productId, ethers.ZeroAddress, true, 1, 1, ethers.ZeroAddress, ethers.ZeroAddress);

      // Get the initial balance of the owner
      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);

      // Purchase SKU with ETH
      await expect(onchainIAP.connect(user).purchaseSKU(productId, skuId, ethers.ZeroAddress, { value: ethPrice }))
        .to.emit(onchainIAP, "PurchaseSuccess")
        .withArgs(user.address, productId, skuId, ethers.ZeroAddress, ethPrice, 100);

      // Check if the owner received the correct amount of ETH
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      expect(finalOwnerBalance - initialOwnerBalance).to.equal(ethPrice);

      // Attempt to purchase SKU with insufficient ETH 
      // Should fail to purchase an SKU with insufficient ETH
      await expect(onchainIAP.connect(user).purchaseSKU(productId, skuId, ethers.ZeroAddress, { value: ethers.parseEther("0.05") }))
        .to.be.revertedWith("OnchainIAP: Insufficient payment");
    });

    it("Should refund excess ETH when overpaying", async function () {
      const { onchainIAP, owner, user } = await loadFixture(basicFixture);
      const productId = 1;
      const skuId = 1;
      const ethPrice = ethers.parseEther("0.1"); // 0.1 ETH
      const overpayment = ethers.parseEther("0.15"); // 0.15 ETH

      // Register product and SKU
      await onchainIAP.registerProduct(productId, 18, owner.address);
      await onchainIAP.registerSKU(productId, skuId, ethPrice, 100);

      // Register ETH as a payment method
      await onchainIAP.registerPaymentMethod(productId, ethers.ZeroAddress, true, 1, 1, ethers.ZeroAddress, ethers.ZeroAddress);

      // Get initial balances
      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      const initialUserBalance = await ethers.provider.getBalance(user.address);

      // Purchase SKU with excess ETH
      const tx = await onchainIAP.connect(user).purchaseSKU(productId, skuId, ethers.ZeroAddress, { value: overpayment });
      const receipt = await tx.wait();

      // Calculate gas cost
      const gasCost = BigInt((receipt?.gasUsed ?? 0)) * BigInt((receipt?.gasPrice ?? 0))

      // Check final balances
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      const finalUserBalance = await ethers.provider.getBalance(user.address);

      // Owner should receive exact price
      expect(finalOwnerBalance - initialOwnerBalance).to.equal(ethPrice);

      // User should be refunded the excess minus gas costs
      const expectedUserBalance = initialUserBalance - ethPrice - gasCost;
      expect(finalUserBalance).to.be.closeTo(expectedUserBalance, ethers.parseEther("0.0001")); // Allow for small rounding errors
    });
  });

  
});