import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployForwarder, deployGateway, deployWhitelistMinter } from "../../lib/deploy";

describe("Test WhitelistMinter Contract", function () {
  async function defaultFixture() {
    const [owner, gatewayAdmin, u0, u1, u2, u3, u4, u5] = await hre.ethers.getSigners();

    const gateway = await deployGateway(gatewayAdmin.address);
    await gateway.connect(gatewayAdmin).addManager(gatewayAdmin.address);
    const forwarder = await deployForwarder();
    const whitelistMinter = await deployWhitelistMinter();

    const tokenName = "TestERC721";
    const tokenSymbol = "TE721";
    const baseURI = "https://api.test/meta/goerli";
    const BasicERC721C = await hre.ethers.getContractFactory("BasicERC721C");
    const erc721 = await BasicERC721C.deploy(tokenName, tokenSymbol, baseURI, gateway, forwarder);
    await erc721.waitForDeployment();

    return { whitelistMinter, owner };
  }

  // const startTime = 1999888777;
  // const boxTokenId = 1;
  // const buyingAmount = 4;
  // const limitForBuyerID = 2728;
  // const limitForTokenID = 2729;
  // const integrationTest = async ({
  //   payWithEth,
  //   deadline,
  //   buyingAmount,
  //   paymentTokenAmount,
  //   limitForBuyerAmount,
  //   limitForTokenAmount,
  // }) => {
  //   // 1. Manager transfers some payment tokens to u1
  //   await paymentToken.transfer(u1.address, paymentTokenAmount);

  //   // 2. Add whitelistMinter to the whitelist
  //   await gateway.connect(gatewayAdmin).addOperatorWhitelist(whitelistMinter.address);

  //   // 3. User approves the whitelistMinter of spending payment tokens
  //   await paymentToken.connect(u1).approve(whitelistMinter.address, paymentTokenAmount);

  //   // 3.2 If paying with ETH, faucet u1 with some ETHs
  //   // TODO

  //   // 5. Reset timestamp
  //   await hre.network.provider.send("evm_setNextBlockTimestamp", [startTime]);

  //   // 6. NFT Manager prepares the signature
  //   const msgHash = ethers.utils.solidityKeccak256(
  //     [
  //       "address", // recipient
  //       "bool", // tokenType
  //       "address", // boxTokenAddress
  //       "uint256", // boxTokenId
  //       "uint256", // amount
  //       "uint256", // limits[0]
  //       "uint256", // limits[1]
  //       "uint256", // limits[2]
  //       "uint256", // limits[3]
  //       "address", // paymentTokenAddress
  //       "uint256", // paymentTokenAmount
  //       "uint256", // deadline
  //       "uint256", // chainid
  //     ],
  //     [
  //       u1.address,
  //       false,
  //       boxToken.address,
  //       boxTokenId,
  //       buyingAmount,
  //       limitForBuyerID,
  //       limitForBuyerAmount,
  //       limitForTokenID,
  //       limitForTokenAmount,
  //       payWithEth ? hre.ethers.constants.AddressZero : paymentToken.address,
  //       paymentTokenAmount,
  //       deadline,
  //       hre.network.config.chainId,
  //     ]
  //   );
  //   const sig = await nftManager.signMessage(ethers.utils.arrayify(msgHash));

  //   // 5. User buy the boxes with signature
  //   await whitelistMinter
  //     .connect(u1)
  //     .mintWithSig(
  //       false,
  //       boxToken.address,
  //       boxTokenId,
  //       buyingAmount,
  //       [limitForBuyerID, limitForBuyerAmount, limitForTokenID, limitForTokenAmount],
  //       payWithEth ? hre.ethers.constants.AddressZero : paymentToken.address,
  //       paymentTokenAmount,
  //       deadline,
  //       sig,
  //       {
  //         value: payWithEth ? paymentTokenAmount : 0,
  //       }
  //     );

  //   /******************** After Buying ********************/

  //   expect(await boxToken.balanceOf(u1.address, boxTokenId)).to.equal(buyingAmount);
  //   if (!payWithEth) {
  //     expect(await paymentToken.balanceOf(u1.address)).to.equal(0);
  //     expect(await paymentToken.balanceOf(nftManager.address)).to.equal(paymentTokenAmount);
  //   }
  // };

  // it("should pass integration test when paying with XTER", async function () {
  //   await integrationTest({
  //     payWithEth: false,
  //     deadline: startTime + 15 * 60,
  //     buyingAmount: 4,
  //     paymentTokenAmount: 120,
  //     limitForBuyerAmount: buyingAmount,
  //     limitForTokenAmount: buyingAmount,
  //   });
  // });

  // it("should pass integration test when paying with ETH", async function () {
  //   await integrationTest({
  //     payWithEth: true,
  //     deadline: startTime + 15 * 60,
  //     buyingAmount: 4,
  //     paymentTokenAmount: 120,
  //     limitForBuyerAmount: buyingAmount,
  //     limitForTokenAmount: buyingAmount,
  //   });
  // });

  // it("should fail integration test if ddl is exceeded", async function () {
  //   await expect(
  //     integrationTest({
  //       payWithEth: false,
  //       deadline: startTime - 1,
  //       buyingAmount: 4,
  //       paymentTokenAmount: 120,
  //       limitForBuyerAmount: buyingAmount,
  //       limitForTokenAmount: buyingAmount,
  //     })
  //   ).to.be.revertedWith("WhitelistMinter: too late");
  // });

  // it("should fail integration test if buyer limit is exceeded", async function () {
  //   await expect(
  //     integrationTest({
  //       payWithEth: false,
  //       deadline: startTime + 15 * 60,
  //       buyingAmount: 4,
  //       paymentTokenAmount: 120,
  //       limitForBuyerAmount: buyingAmount - 1,
  //       limitForTokenAmount: buyingAmount,
  //     })
  //   ).to.be.revertedWith("WhitelistMinter: buyer limit exceeded");
  // });

  // it("should fail integration test if token limit is exceeded", async function () {
  //   await expect(
  //     integrationTest({
  //       payWithEth: false,
  //       deadline: startTime + 15 * 60,
  //       buyingAmount: 4,
  //       paymentTokenAmount: 120,
  //       limitForBuyerAmount: buyingAmount,
  //       limitForTokenAmount: buyingAmount - 1,
  //     })
  //   ).to.be.revertedWith("WhitelistMinter: token limit exceeded");
  // });
});
