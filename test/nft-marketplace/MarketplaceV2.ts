import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployMarketplaceV2 } from "../../lib/deploy";
import { nftTradingTestFixture } from "../common_fixtures";
import { AddressLike, BigNumberish } from "ethers";
import { BasicERC1155C, BasicERC721C, MarketplaceV2, TokenGateway, XterToken } from "../../typechain-types";

async function defaultFixture() {
  const base = await nftTradingTestFixture();
  const [, , , platform, seller, buyer, user3, randomUser] = await hre.ethers.getSigners();
  const marketplace = await deployMarketplaceV2(base.gateway, base.paymentToken, platform.address);
  // Add marketplace to the token operator whitelist.
  await base.gateway.connect(base.gatewayAdmin).addOperatorWhitelist(marketplace);
  return { ...base, marketplace, platform, seller, buyer, user3, randomUser };
}

describe("Test Marketplace Contract", function () {
  const BASE = 10000;

  let gateway: TokenGateway,
    paymentToken: XterToken,
    marketplace: MarketplaceV2,
    erc721: BasicERC721C,
    erc1155: BasicERC1155C;
  let [platform, seller, buyer, nftManager]: HardhatEthersSigner[] = [];
  let [marketplaceAddr, erc721Addr, erc1155Addr, paymentTokenAddr]: AddressLike[] = [];

  this.beforeEach(async () => {
    ({ gateway, paymentToken, marketplace, erc721, erc1155, platform, seller, buyer, nftManager } = await loadFixture(
      defaultFixture
    ));
    marketplaceAddr = await marketplace.getAddress();
    erc721Addr = await erc721.getAddress();
    erc1155Addr = await erc1155.getAddress();
    paymentTokenAddr = await paymentToken.getAddress();
  });

  describe("ERC721 <> ERC20", () => {
    const getOrderInfo = async ({
      tokenId,
      price,
      balance,
      serviceFee,
      royaltyFee,
      sellerListingTime,
      sellerExpirationTime,
      sellerSalt,
      buyerSalt,
      sellerMaximumFill,
      buyerMaximumFill,
      sellerSellOrBuy,
      buyerSellOrBuy,
    }: {
      tokenId: BigNumberish;
      price: number;
      balance: BigNumberish;
      serviceFee: number;
      royaltyFee: number;
      sellerListingTime: BigNumberish;
      sellerExpirationTime: BigNumberish;
      sellerSalt: BigNumberish;
      buyerSalt: BigNumberish;
      sellerMaximumFill?: BigNumberish;
      buyerMaximumFill?: BigNumberish;
      sellerSellOrBuy?: boolean;
      buyerSellOrBuy?: boolean;
    }) => {
      const transactionType = await marketplace.TRANSACT_ERC721();

      // Mints paymentToken to buyer
      await paymentToken.transfer(buyer.address, balance);
      // Manager1 mints an NFT to seller.
      await gateway.connect(nftManager).ERC721_mint(erc721, seller.address, tokenId);

      /**
       * 1. seller puts a sell bid on the market
       * 2. buyer matches that bid, buys directly
       */

      // Get seller's nft tokenId
      const sellerBalance = await erc721.balanceOf(seller.address);
      expect(sellerBalance).to.equal(1);

      const encoder = new hre.ethers.AbiCoder();

      // Prepare Order info
      const order = {
        marketplaceAddress: marketplaceAddr,
        targetTokenAddress: erc721Addr,
        targetTokenId: tokenId,
        paymentTokenAddress: paymentTokenAddr,
        price: price,
        serviceFee: serviceFee,
        royaltyFee: royaltyFee,
        royaltyFeeReceipient: nftManager.address,
        allowMint: false,
      };

      const orderBytes = encoder.encode(
        ["address", "address", "uint256", "address", "uint256", "uint256", "uint256", "address", "bool"],
        [
          order.marketplaceAddress,
          order.targetTokenAddress,
          order.targetTokenId,
          order.paymentTokenAddress,
          order.price,
          order.serviceFee,
          order.royaltyFee,
          order.royaltyFeeReceipient,
          order.allowMint,
        ]
      );

      // Prepare seller metadata
      const sellerMetadata = {
        sellOrBuy: sellerSellOrBuy == undefined ? true : sellerSellOrBuy,
        recipient: seller.address,
        listingTime: sellerListingTime,
        expirationTime: sellerExpirationTime,
        maximumFill: sellerMaximumFill || 1,
        forceFilled: false,
        salt: sellerSalt,
      };
      const sellerMetadataBytes = encoder.encode(
        ["bool", "address", "uint256", "uint256", "uint256", "bool", "uint256"],
        [
          sellerMetadata.sellOrBuy,
          sellerMetadata.recipient,
          sellerMetadata.listingTime,
          sellerMetadata.expirationTime,
          sellerMetadata.maximumFill,
          sellerMetadata.forceFilled,
          sellerMetadata.salt,
        ]
      );

      // Seller signs
      const sellerMessageHash = hre.ethers.solidityPackedKeccak256(
        ["bytes32", "bytes", "bytes"],
        [transactionType, orderBytes, sellerMetadataBytes]
      );
      const sellerSig = await seller.signMessage(hre.ethers.getBytes(sellerMessageHash));

      // Prepare buyer metadata
      const buyerMetadata = {
        sellOrBuy: buyerSellOrBuy == undefined ? false : buyerSellOrBuy,
        recipient: buyer.address,
        listingTime: 0,
        expirationTime: 0,
        maximumFill: buyerMaximumFill || 1,
        forceFilled: false,
        salt: buyerSalt,
      };
      const buyerMetadataBytes = encoder.encode(
        ["bool", "address", "uint256", "uint256", "uint256", "bool", "uint256"],
        [
          buyerMetadata.sellOrBuy,
          buyerMetadata.recipient,
          buyerMetadata.listingTime,
          buyerMetadata.expirationTime,
          buyerMetadata.maximumFill,
          buyerMetadata.forceFilled,
          buyerMetadata.salt,
        ]
      );

      // Buyer signs
      const buyerMessageHash = hre.ethers.solidityPackedKeccak256(
        ["bytes32", "bytes", "bytes"],
        [transactionType, orderBytes, buyerMetadataBytes]
      );
      const buyerSig = await buyer.signMessage(hre.ethers.getBytes(buyerMessageHash));

      return {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        sellerMessageHash,
        buyerMetadataBytes,
        buyerSig,
        buyerMessageHash,
      };
    };

    it("Basic transactions matching", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000011";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000012";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      /**
       * Checks
       */
      const platFormFee = (price * order.serviceFee) / BASE;
      const managerFee = (price * order.royaltyFee) / BASE;

      expect(await paymentToken.balanceOf(buyer.address)).to.equal(0);
      expect(await paymentToken.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await paymentToken.balanceOf(nftManager.address)).to.equal(managerFee);
      expect(await paymentToken.balanceOf(seller.address)).to.equal(price - platFormFee - managerFee);
    });

    it("Deposit on order matching", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000011";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000012";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await marketplace.atomicMatchAndDeposit(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      /**
       * Checks
       */
      const platFormFee = (price * order.serviceFee) / BASE;
      const managerFee = (price * order.royaltyFee) / BASE;

      expect(await paymentToken.balanceOf(buyer.address)).to.equal(0);
      expect(await paymentToken.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await paymentToken.balanceOf(nftManager.address)).to.equal(managerFee);
      expect(await paymentToken.balanceOf(seller.address)).to.equal(price - platFormFee - managerFee);

      // The token is transferred directly to the nft manager's address.
      expect(await erc721.ownerOf(tokenId)).to.equal(nftManager.address);
    });

    it("Seller is taker", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000013";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000014";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await marketplace
        .connect(seller)
        .atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          "0x",
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        );

      /**
       * Checks
       */
      const platFormFee = (price * order.serviceFee) / BASE;
      const managerFee = (price * order.royaltyFee) / BASE;

      expect(await paymentToken.balanceOf(buyer.address)).to.equal(0);
      expect(await paymentToken.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await paymentToken.balanceOf(nftManager.address)).to.equal(managerFee);
      expect(await paymentToken.balanceOf(seller.address)).to.equal(price - platFormFee - managerFee);
    });

    it("Buyer is taker", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000015";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000016";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await marketplace
        .connect(buyer)
        .atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          "0x"
        );

      /**
       * Checks
       */
      const platFormFee = (price * order.serviceFee) / BASE;
      const managerFee = (price * order.royaltyFee) / BASE;

      expect(await paymentToken.balanceOf(buyer.address)).to.equal(0);
      expect(await paymentToken.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await paymentToken.balanceOf(nftManager.address)).to.equal(managerFee);
      expect(await paymentToken.balanceOf(seller.address)).to.equal(price - platFormFee - managerFee);
    });

    it("Sell order not started", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 99999999999999;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000017";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000018";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("MarketplaceV2: sell order not in effect");
    });

    it("Sell order expired - case 2", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 1;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000017";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000018";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("MarketplaceV2: sell order expired");
    });

    it("Buyer balance too low", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 999;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000021";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000022";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("MarketplaceV2: buyer doesn't have enough token to buy this item");
    });

    it("Already sold", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000023";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000024";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );
      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("MarketplaceV2: sell order has been filled");
    });

    it("Seller cancels order", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000025";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000026";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        sellerMessageHash,
        buyerMetadataBytes,
        buyerSig,
        buyerMessageHash,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await marketplace.connect(seller).ignoreMessageHash(sellerMessageHash);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("MarketplaceV2: sell order has been revoked");
    });

    it("Buyer cancels order", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000027";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000028";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        sellerMessageHash,
        buyerMetadataBytes,
        buyerSig,
        buyerMessageHash,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await marketplace.connect(buyer).ignoreMessageHash(buyerMessageHash);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("MarketplaceV2: buy order has been revoked");
    });

    it("Seller cancels twice", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000051";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000052";

      const {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        sellerMessageHash,
        buyerMetadataBytes,
        buyerSig,
      } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerListingTime,
        sellerExpirationTime,
        sellerSalt,
        buyerSalt,
      });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await marketplace.connect(seller).ignoreMessageHash(sellerMessageHash);
      await expect(marketplace.connect(seller).ignoreMessageHash(sellerMessageHash)).to.be.revertedWith(
        "MarketplaceV2: order has been revoked"
      );
    });

    it("Invalid seller signature", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000031";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000032";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          buyerSig, // Wrong seller signature
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("MarketplaceV2: invalid seller signature");
    });

    it("Invalid buyer signature", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000033";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000034";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          sellerSig // Wrong buyer signature
        )
      ).to.be.revertedWith("MarketplaceV2: invalid buyer signature");
    });

    it("Invalid fill", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000061";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000062";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerSalt,
          buyerSalt,
          buyerMaximumFill: 1,
          sellerMaximumFill: 2,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("MarketplaceV2: invalid maximumFill");
    });

    it("Seller buys", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000091";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000092";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerSalt,
          buyerSalt,
          sellerSellOrBuy: false,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("MarketplaceV2: seller should sell");
    });

    it("Buyer sells", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000091";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000092";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerSalt,
          buyerSalt,
          buyerSellOrBuy: true,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("MarketplaceV2: buyer should buy");
    });

    it("Manager <> user transaction", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 1000;
      const serviceFee = 5000;
      const royaltyFee = 0;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000035";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000036";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc721.connect(seller).approve(marketplaceAddr, tokenId);
      await paymentToken.connect(buyer).approve(marketplaceAddr, price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      /**
       * Checks
       */
      const platFormFee = (price * order.serviceFee) / BASE;
      const managerFee = 0;

      expect(await paymentToken.balanceOf(buyer.address)).to.equal(0);

      expect(await paymentToken.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await paymentToken.balanceOf(nftManager.address)).to.equal(0);
      expect(await paymentToken.balanceOf(seller.address)).to.equal(price - platFormFee - managerFee);
    });
  });

  describe("ERC1155 <> ERC20", () => {
    const getOrderInfo = async ({
      tokenId,
      price,
      balance,
      serviceFee,
      royaltyFee,
      sellerMaximumFill,
      sellerSalt,
      buyerMaximumFill,
      buyerSalt,
      sellerListingTime,
      sellerExpirationTime,
      sellerSellOrBuy,
      buyerSellOrBuy,
    }: {
      tokenId: BigNumberish;
      price: number;
      balance: BigNumberish;
      serviceFee: number;
      royaltyFee: number;
      sellerListingTime?: BigNumberish;
      sellerExpirationTime?: BigNumberish;
      sellerSalt: BigNumberish;
      buyerSalt: BigNumberish;
      sellerMaximumFill: BigNumberish;
      buyerMaximumFill?: BigNumberish;
      sellerSellOrBuy?: boolean;
      buyerSellOrBuy?: boolean;
    }) => {
      const transactionType = await marketplace.TRANSACT_ERC1155();

      // Mints paymentToken to buyer
      await paymentToken.transfer(buyer.address, balance);
      // Manager of some erc1155 mints some NFT to seller.
      await gateway.connect(nftManager).ERC1155_mint(erc1155Addr, seller.address, tokenId, sellerMaximumFill, "0x");

      /**
       * 1. seller puts a sell bid on the market
       * 2. buyer matches that bid, buys directly
       */

      const encoder = new hre.ethers.AbiCoder();

      // Prepare Order info
      const order = {
        marketplaceAddress: marketplaceAddr,
        targetTokenAddress: erc1155Addr,
        targetTokenId: tokenId,
        paymentTokenAddress: paymentTokenAddr,
        price: price,
        serviceFee: serviceFee,
        royaltyFee: royaltyFee,
        royaltyFeeReceipient: nftManager.address,
        allowMint: false,
      };

      const orderBytes = encoder.encode(
        ["address", "address", "uint256", "address", "uint256", "uint256", "uint256", "address", "bool"],
        [
          order.marketplaceAddress,
          order.targetTokenAddress,
          order.targetTokenId,
          order.paymentTokenAddress,
          order.price,
          order.serviceFee,
          order.royaltyFee,
          order.royaltyFeeReceipient,
          order.allowMint,
        ]
      );

      // Prepare seller metadata
      const sellerMetadata = {
        sellOrBuy: sellerSellOrBuy == undefined ? true : sellerSellOrBuy,
        recipient: seller.address,
        listingTime: sellerListingTime || 0,
        expirationTime: sellerExpirationTime || 0,
        maximumFill: sellerMaximumFill,
        forceFilled: false,
        salt: sellerSalt,
      };
      const sellerMetadataBytes = encoder.encode(
        ["bool", "address", "uint256", "uint256", "uint256", "bool", "uint256"],
        [
          sellerMetadata.sellOrBuy,
          sellerMetadata.recipient,
          sellerMetadata.listingTime,
          sellerMetadata.expirationTime,
          sellerMetadata.maximumFill,
          sellerMetadata.forceFilled,
          sellerMetadata.salt,
        ]
      );

      // Seller signs
      const sellerMessageHash = hre.ethers.solidityPackedKeccak256(
        ["bytes32", "bytes", "bytes"],
        [transactionType, orderBytes, sellerMetadataBytes]
      );
      const sellerSig = await seller.signMessage(hre.ethers.getBytes(sellerMessageHash));

      // Prepare buyer metadata
      const buyerMetadata = {
        sellOrBuy: buyerSellOrBuy == undefined ? false : buyerSellOrBuy,
        recipient: buyer.address,
        listingTime: 0,
        expirationTime: 0,
        maximumFill: buyerMaximumFill,
        forceFilled: false,
        salt: buyerSalt,
      };
      const buyerMetadataBytes = encoder.encode(
        ["bool", "address", "uint256", "uint256", "uint256", "bool", "uint256"],
        [
          buyerMetadata.sellOrBuy,
          buyerMetadata.recipient,
          buyerMetadata.listingTime,
          buyerMetadata.expirationTime,
          buyerMetadata.maximumFill,
          buyerMetadata.forceFilled,
          buyerMetadata.salt,
        ]
      );

      // Buyer signs
      const buyerMessageHash = hre.ethers.solidityPackedKeccak256(
        ["bytes32", "bytes", "bytes"],
        [transactionType, orderBytes, buyerMetadataBytes]
      );
      const buyerSig = await buyer.signMessage(hre.ethers.getBytes(buyerMessageHash));

      return {
        transactionType,
        order,
        orderBytes,
        sellerMetadataBytes,
        sellerSig,
        buyerMetadataBytes,
        buyerSig,
      };
    };

    it("Basic transactions matching", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 10000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerMaximumFill = 10;
      const buyerMaximumFill = 10;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000011";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000012";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerMaximumFill,
          buyerMaximumFill,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending all.
       * 2. Buyer approves the marketplace contract of spending buyerMaxmumFill amount.
       */
      await erc1155.connect(seller).setApprovalForAll(marketplaceAddr, true);
      await paymentToken.connect(buyer).approve(marketplaceAddr, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      /**
       * Checks
       */
      const totalCost = Math.min(sellerMaximumFill, buyerMaximumFill) * price;
      const platFormFee = (totalCost * order.serviceFee) / BASE;
      const managerFee = (totalCost * order.royaltyFee) / BASE;

      expect(await paymentToken.balanceOf(buyer.address)).to.equal(balance - totalCost);
      expect(await paymentToken.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await paymentToken.balanceOf(nftManager.address)).to.equal(managerFee);
      expect(await paymentToken.balanceOf(seller.address)).to.equal(totalCost - platFormFee - managerFee);
    });

    it("Deposit on order matching", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 10000000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerListingTime = 0;
      const sellerExpirationTime = 0;
      const sellerMaximumFill = 10;
      const buyerMaximumFill = 10;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000011";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000012";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerListingTime,
          sellerExpirationTime,
          sellerMaximumFill,
          buyerMaximumFill,
          sellerSalt,
          buyerSalt,
        });

      const fillAmt = Math.min(sellerMaximumFill, buyerMaximumFill);
      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending `tokenId`.
       * 2. Buyer approves the marketplace contract of spending `price` amount.
       */
      await erc1155.connect(seller).setApprovalForAll(marketplaceAddr, true);

      await paymentToken.connect(buyer).approve(marketplaceAddr, fillAmt * price);

      const originBalance = await erc1155.balanceOf(seller.address, tokenId);

      await marketplace.atomicMatchAndDeposit(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      /**
       * Checks
       */
      const totalCost = fillAmt * price;
      const platFormFee = (totalCost * order.serviceFee) / BASE;
      const managerFee = (totalCost * order.royaltyFee) / BASE;

      expect(await paymentToken.balanceOf(buyer.address)).to.equal(balance - totalCost);
      expect(await paymentToken.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await paymentToken.balanceOf(nftManager.address)).to.equal(managerFee);
      expect(await paymentToken.balanceOf(seller.address)).to.equal(totalCost - platFormFee - managerFee);

      // nft manager's address token number not change
      expect(await erc1155.balanceOf(seller.address, tokenId)).to.equal(Number(originBalance) - fillAmt);
      expect(await erc1155.balanceOf(nftManager.address, tokenId)).to.equal(fillAmt);
    });

    it("Seller sells more", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 10000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerMaximumFill = 20;
      const buyerMaximumFill = 10;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000013";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000014";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerMaximumFill,
          buyerMaximumFill,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending all.
       * 2. Buyer approves the marketplace contract of spending buyerMaxmumFill amount.
       */
      await erc1155.connect(seller).setApprovalForAll(marketplaceAddr, true);
      await paymentToken.connect(buyer).approve(marketplaceAddr, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      /**
       * Checks
       */
      const totalCost = Math.min(sellerMaximumFill, buyerMaximumFill) * price;
      const platFormFee = (totalCost * order.serviceFee) / BASE;
      const managerFee = (totalCost * order.royaltyFee) / BASE;

      expect(await paymentToken.balanceOf(buyer.address)).to.equal(0);
      expect(await paymentToken.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await paymentToken.balanceOf(nftManager.address)).to.equal(managerFee);
      expect(await paymentToken.balanceOf(seller.address)).to.equal(totalCost - platFormFee - managerFee);
    });

    it("Buyer buys more", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 20000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerMaximumFill = 10;
      const buyerMaximumFill = 20;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000015";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000016";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerMaximumFill,
          buyerMaximumFill,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending all.
       * 2. Buyer approves the marketplace contract of spending buyerMaxmumFill amount.
       */
      await erc1155.connect(seller).setApprovalForAll(marketplaceAddr, true);
      await paymentToken.connect(buyer).approve(marketplaceAddr, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      /**
       * Checks
       */
      const totalCost = Math.min(sellerMaximumFill, buyerMaximumFill) * price;
      const platFormFee = (totalCost * order.serviceFee) / BASE;
      const managerFee = (totalCost * order.royaltyFee) / BASE;

      expect(await paymentToken.balanceOf(buyer.address)).to.equal(balance - totalCost);
      expect(await paymentToken.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await paymentToken.balanceOf(nftManager.address)).to.equal(managerFee);
      expect(await paymentToken.balanceOf(seller.address)).to.equal(totalCost - platFormFee - managerFee);
    });

    it("Buy twice using same signature", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 10000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerMaximumFill = 10;
      const buyerMaximumFill = 5;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000017";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000018";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerMaximumFill,
          buyerMaximumFill,
          sellerSalt,
          buyerSalt,
        });

      /**
       * Transaction preparations.
       * 1. Seller approves the marketplace contract of spending all.
       * 2. Buyer approves the marketplace contract of spending buyerMaxmumFill amount.
       */
      await erc1155.connect(seller).setApprovalForAll(marketplaceAddr, true);
      await paymentToken.connect(buyer).approve(marketplaceAddr, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      await paymentToken.connect(buyer).approve(marketplaceAddr, buyerMaximumFill * price);

      await expect(
        marketplace.atomicMatch(
          transactionType,
          orderBytes,
          seller.address,
          sellerMetadataBytes,
          sellerSig,
          buyer.address,
          buyerMetadataBytes,
          buyerSig
        )
      ).to.be.revertedWith("MarketplaceV2: buy order has been filled");
    });

    it("Buy twice using different signature", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 10000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerMaximumFill = 10;
      const buyerMaximumFill = 5;
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000021";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000022";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerMaximumFill,
          buyerMaximumFill,
          sellerSalt,
          buyerSalt,
        });

      await erc1155.connect(seller).setApprovalForAll(marketplaceAddr, true);
      await paymentToken.connect(buyer).approve(marketplaceAddr, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      // The second buy

      const buyerSalt2 = "0x0000000000000000000000000000000000000000000000000000000000000023";

      const { buyerMetadataBytes: buyerMetadataBytes2, buyerSig: buyerSig2 } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerMaximumFill,
        buyerMaximumFill,
        sellerSalt,
        buyerSalt: buyerSalt2,
      });

      await paymentToken.connect(buyer).approve(marketplaceAddr, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes2,
        buyerSig2
      );

      /**
       * Checks
       */
      const totalCost = Math.min(sellerMaximumFill, 2 * buyerMaximumFill) * price;
      const platFormFee = (totalCost * order.serviceFee) / BASE;
      const managerFee = (totalCost * order.royaltyFee) / BASE;

      expect(await paymentToken.balanceOf(buyer.address)).to.equal(balance * 2 - totalCost);
      expect(await paymentToken.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await paymentToken.balanceOf(nftManager.address)).to.equal(managerFee);
      expect(await paymentToken.balanceOf(seller.address)).to.equal(totalCost - platFormFee - managerFee);
    });

    it("Buy twice exceeding selling amount", async function () {
      const tokenId = 1;
      const price = 1000;
      const balance = 12000;
      const serviceFee = 100;
      const royaltyFee = 100;
      const sellerMaximumFill = 10;
      const buyerMaximumFill = 6; // 6 + 6 > 10
      const sellerSalt = "0x0000000000000000000000000000000000000000000000000000000000000031";
      const buyerSalt = "0x0000000000000000000000000000000000000000000000000000000000000032";

      const { transactionType, order, orderBytes, sellerMetadataBytes, sellerSig, buyerMetadataBytes, buyerSig } =
        await getOrderInfo({
          tokenId,
          price,
          balance,
          serviceFee,
          royaltyFee,
          sellerMaximumFill,
          buyerMaximumFill,
          sellerSalt,
          buyerSalt,
        });

      await erc1155.connect(seller).setApprovalForAll(marketplaceAddr, true);
      await paymentToken.connect(buyer).approve(marketplaceAddr, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes,
        buyerSig
      );

      // The second buy

      const buyerSalt2 = "0x0000000000000000000000000000000000000000000000000000000000001234";

      const { buyerMetadataBytes: buyerMetadataBytes2, buyerSig: buyerSig2 } = await getOrderInfo({
        tokenId,
        price,
        balance,
        serviceFee,
        royaltyFee,
        sellerMaximumFill,
        buyerMaximumFill,
        sellerSalt,
        buyerSalt: buyerSalt2,
      });

      await paymentToken.connect(buyer).approve(marketplaceAddr, buyerMaximumFill * price);

      await marketplace.atomicMatch(
        transactionType,
        orderBytes,
        seller.address,
        sellerMetadataBytes,
        sellerSig,
        buyer.address,
        buyerMetadataBytes2,
        buyerSig2
      );

      /**
       * Checks
       */
      const totalCost = Math.min(sellerMaximumFill, 2 * buyerMaximumFill) * price;
      const platFormFee = (totalCost * order.serviceFee) / BASE;
      const managerFee = (totalCost * order.royaltyFee) / BASE;

      expect(await paymentToken.balanceOf(buyer.address)).to.equal(balance * 2 - totalCost);
      expect(await paymentToken.balanceOf(platform.address)).to.equal(platFormFee);
      expect(await paymentToken.balanceOf(nftManager.address)).to.equal(managerFee);
      expect(await paymentToken.balanceOf(seller.address)).to.equal(totalCost - platFormFee - managerFee);
    });
  });
});
