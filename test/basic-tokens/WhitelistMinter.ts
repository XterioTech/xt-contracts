import hre from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployWhitelistMinter } from "../../lib/deploy";
import { nftTradingTestFixture } from "../common_fixtures";

async function defaultFixture() {
  const base = await nftTradingTestFixture();
  const whitelistMinter = await deployWhitelistMinter(base.gateway);
  // Add whitelistMinter to the whitelist
  await base.gateway.connect(base.gatewayAdmin).addOperatorWhitelist(whitelistMinter);
  const [, , , u1, u2, u3, u4, u5] = await hre.ethers.getSigners();

  return { ...base, whitelistMinter, u1, u2, u3, u4, u5 };
}

describe("Test WhitelistMinter Contract", function () {
  const startTime = 1999888777;
  const erc1155TokenId = 1;
  const buyingAmount = 4;
  const limitForBuyerID = 2728;
  const limitForTokenID = 2729;

  interface IntegrateTestParam {
    payWithEth: boolean;
    deadline: number;
    buyingAmount: number;
    paymentTokenAmount: number;
    limitForBuyerAmount: number;
    limitForTokenAmount: number;
  }

  const integrationTest = async (params: IntegrateTestParam) => {
    await integrationTest1155(params);
    await integrationTest721(params);
  };

  const integrationTest1155 = async ({
    payWithEth,
    deadline,
    buyingAmount,
    paymentTokenAmount,
    limitForBuyerAmount,
    limitForTokenAmount,
  }: IntegrateTestParam) => {
    const { paymentToken, whitelistMinter, erc1155, nftManager, u1 } = await loadFixture(defaultFixture);
    // 1. Manager transfers some payment tokens to u1
    await paymentToken.transfer(u1.address, paymentTokenAmount);

    // 2. User approves the whitelistMinter of spending payment tokens
    await paymentToken.connect(u1).approve(whitelistMinter, paymentTokenAmount);

    // 3 If paying with ETH, faucet u1 with some ETHs
    // TODO

    // 4. Reset timestamp
    time.setNextBlockTimestamp(startTime);

    // 5. NFT Manager prepares the signature
    const msgHash = hre.ethers.solidityPackedKeccak256(
      [
        "address", // recipient
        "bool", // tokenType
        "address", // nft token address
        "uint256", // nft token id (for 1155)
        "uint256", // amount
        "uint256", // limits[0]
        "uint256", // limits[1]
        "uint256", // limits[2]
        "uint256", // limits[3]
        "address", // paymentTokenAddress
        "uint256", // paymentTokenAmount
        "uint256", // deadline
        "uint256", // chainid
      ],
      [
        u1.address,
        false,
        await erc1155.getAddress(),
        erc1155TokenId,
        buyingAmount,
        limitForBuyerID,
        limitForBuyerAmount,
        limitForTokenID,
        limitForTokenAmount,
        payWithEth ? hre.ethers.ZeroAddress : await paymentToken.getAddress(),
        paymentTokenAmount,
        deadline,
        hre.network.config.chainId,
      ]
    );
    const sig = await nftManager.signMessage(hre.ethers.getBytes(msgHash));

    // 6. User buy the boxes with signature
    await whitelistMinter
      .connect(u1)
      .mintWithSig(
        false,
        erc1155,
        erc1155TokenId,
        buyingAmount,
        [limitForBuyerID, limitForBuyerAmount, limitForTokenID, limitForTokenAmount],
        payWithEth ? hre.ethers.ZeroAddress : paymentToken,
        paymentTokenAmount,
        deadline,
        sig,
        {
          value: payWithEth ? paymentTokenAmount : 0,
        }
      );

    /******************** After Buying ********************/

    expect(await erc1155.balanceOf(u1.address, erc1155TokenId)).to.equal(buyingAmount);
    if (!payWithEth) {
      expect(await paymentToken.balanceOf(u1.address)).to.equal(0);
      expect(await paymentToken.balanceOf(nftManager.address)).to.equal(paymentTokenAmount);
    }
  };

  const integrationTest721 = async ({
    payWithEth,
    deadline,
    buyingAmount,
    paymentTokenAmount,
    limitForBuyerAmount,
    limitForTokenAmount,
  }: IntegrateTestParam) => {
    const { paymentToken, whitelistMinter, erc721, nftManager, u1 } = await loadFixture(defaultFixture);
    // 1. Manager transfers some payment tokens to u1
    await paymentToken.transfer(u1.address, paymentTokenAmount);

    // 2. User approves the whitelistMinter of spending payment tokens
    await paymentToken.connect(u1).approve(whitelistMinter, paymentTokenAmount);

    // 3 If paying with ETH, faucet u1 with some ETHs
    // TODO

    // 4. Reset timestamp
    time.setNextBlockTimestamp(startTime);

    // 5. NFT Manager prepares the signature
    const msgHash = hre.ethers.solidityPackedKeccak256(
      [
        "address", // recipient
        "bool", // tokenType
        "address", // nft token address
        "uint256", // nft token id (for 1155)
        "uint256", // amount
        "uint256", // limits[0]
        "uint256", // limits[1]
        "uint256", // limits[2]
        "uint256", // limits[3]
        "address", // paymentTokenAddress
        "uint256", // paymentTokenAmount
        "uint256", // deadline
        "uint256", // chainid
      ],
      [
        u1.address,
        true,
        await erc721.getAddress(),
        0,
        buyingAmount,
        limitForBuyerID,
        limitForBuyerAmount,
        limitForTokenID,
        limitForTokenAmount,
        payWithEth ? hre.ethers.ZeroAddress : await paymentToken.getAddress(),
        paymentTokenAmount,
        deadline,
        hre.network.config.chainId,
      ]
    );
    const sig = await nftManager.signMessage(hre.ethers.getBytes(msgHash));

    // 6. User buy the nft with signature
    await whitelistMinter
      .connect(u1)
      .mintWithSig(
        true,
        erc721,
        0,
        buyingAmount,
        [limitForBuyerID, limitForBuyerAmount, limitForTokenID, limitForTokenAmount],
        payWithEth ? hre.ethers.ZeroAddress : paymentToken,
        paymentTokenAmount,
        deadline,
        sig,
        {
          value: payWithEth ? paymentTokenAmount : 0,
        }
      );

    /******************** After Buying ********************/

    expect(await erc721.ownerOf(1)).to.equal(u1.address);
    if (!payWithEth) {
      expect(await paymentToken.balanceOf(u1.address)).to.equal(0);
      expect(await paymentToken.balanceOf(nftManager.address)).to.equal(paymentTokenAmount);
    }
  };

  it("should pass integration test when paying with XTER", async function () {
    await integrationTest({
      payWithEth: false,
      deadline: startTime + 15 * 60,
      buyingAmount: 4,
      paymentTokenAmount: 120,
      limitForBuyerAmount: buyingAmount,
      limitForTokenAmount: buyingAmount,
    });
  });

  it("should pass integration test when paying with ETH", async function () {
    await integrationTest({
      payWithEth: true,
      deadline: startTime + 15 * 60,
      buyingAmount: 4,
      paymentTokenAmount: 120,
      limitForBuyerAmount: buyingAmount,
      limitForTokenAmount: buyingAmount,
    });
  });

  it("should fail integration test if ddl is exceeded", async function () {
    await expect(
      integrationTest({
        payWithEth: false,
        deadline: startTime - 1,
        buyingAmount: 4,
        paymentTokenAmount: 120,
        limitForBuyerAmount: buyingAmount,
        limitForTokenAmount: buyingAmount,
      })
    ).to.be.revertedWith("WhitelistMinter: too late");
  });

  it("should fail integration test if buyer limit is exceeded", async function () {
    await expect(
      integrationTest({
        payWithEth: false,
        deadline: startTime + 15 * 60,
        buyingAmount: 4,
        paymentTokenAmount: 120,
        limitForBuyerAmount: buyingAmount - 1,
        limitForTokenAmount: buyingAmount,
      })
    ).to.be.revertedWith("WhitelistMinter: buyer limit exceeded");
  });

  it("should fail integration test if token limit is exceeded", async function () {
    await expect(
      integrationTest({
        payWithEth: false,
        deadline: startTime + 15 * 60,
        buyingAmount: 4,
        paymentTokenAmount: 120,
        limitForBuyerAmount: buyingAmount,
        limitForTokenAmount: buyingAmount - 1,
      })
    ).to.be.revertedWith("WhitelistMinter: token limit exceeded");
  });
});
