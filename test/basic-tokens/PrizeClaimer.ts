import hre from "hardhat";
import { expect } from "chai";
import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployPrizeClaimer } from "../../lib/deploy";
import { commonERC721estFixture, commonTradingTestFixture } from "../common_fixtures";
import { PrizeClaimer } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
  ContractTransactionResponse,
  ContractTransactionReceipt,
  getBigInt
} from 'ethers'


async function defaultFixture() {
  const [admin, signer, u0, u1, u2, u3, u4, u5] = await hre.ethers.getSigners();
  const base = await commonTradingTestFixture();

  const { erc721: scoreNFT } = await commonERC721estFixture(base, "ScoreNFT", "ScoreNFT", "ScoreNFT", base.manager)

  const prizeClaimer = await deployPrizeClaimer(base.gateway, signer.address, await scoreNFT.getAddress());
  // Add whitelistMinter to the whitelist
  await base.gateway
    .connect(base.gatewayAdmin)
    .addOperatorWhitelist(prizeClaimer);

  return { base, prizeClaimer, admin, signer, scoreNFT, u0, u1, u2, u3, u4, u5 };
}

async function constructAndClaim(
  prizeClaimer: PrizeClaimer,
  signer: HardhatEthersSigner,
  recipient: HardhatEthersSigner,
  _prizeTypeIdx: number,
  _scoreNFTAddress: string,
  _scoreNFTTokenId: number,
  _prizeTokenAddress: string,
  _prizeTokenId: number,
  _prizeTokenAmount: number | string,
  deadline: number
) {
  // 3. NFT Manager prepares the signature
  const msgHash = hre.ethers.solidityPackedKeccak256(
    [
      "address", // recipient
      "uint8",// _prizeTypeIdx,
      "address",// _scoreNFTAddress,
      "uint256",// _scoreNFTTokenId,
      "address",// _prizeTokenAddress,
      "uint256",// _prizeTokenId,
      "uint256",// _prizeTokenAmount,
      "uint256", // deadline
      "uint256", // chainid
    ],
    [
      recipient.address,
      _prizeTypeIdx,
      _scoreNFTAddress,
      _scoreNFTTokenId,
      _prizeTokenAddress,
      _prizeTokenId,
      _prizeTokenAmount,
      deadline,
      hre.network.config.chainId,
    ]
  );
  const sig = await signer.signMessage(hre.ethers.getBytes(msgHash));

  // 4. User claime the prize
  return await prizeClaimer
    .connect(recipient)
    .claimWithSig(
      _prizeTypeIdx,
      _scoreNFTAddress,
      _scoreNFTTokenId,
      _prizeTokenAddress,
      _prizeTokenId,
      _prizeTokenAmount,
      deadline,
      sig
    );
}


describe("Test PrizeClaimer Contract", function () {
  it.only("should pass Type1 test", async function () {
    const { base, admin, signer, u0, u1, prizeClaimer, scoreNFT } = await loadFixture(defaultFixture);
    const { gateway, gatewayAdmin, manager, erc1155: Coupon, erc721: DINO, erc20: DAM } = base

    this.timeout(30 * 1000);
    const startTime = 1999888777;
    const deadline = startTime + 15 * 60;

    // 1. Manager mints some scoreNFT tokens to u1 as the prizeClaimer tokens
    await gateway.connect(manager).ERC721_mint(await scoreNFT.getAddress(), u1.address, 0);
    expect(await scoreNFT.balanceOf(u1.address)).to.equal(1);

    // 2. Reset timestamp
    time.setNextBlockTimestamp(startTime);

    const _prizeTypeIdx = 0   //Type1 = ERC721, 1 * Dinosaur NFT
    const _scoreNFTAddress = await scoreNFT.getAddress()
    const _scoreNFTTokenId = 1
    const _prizeTokenAddress = await DINO.getAddress()
    const _prizeTokenId = 0
    const _prizeTokenAmount = 1
    await constructAndClaim(prizeClaimer, signer, u1, _prizeTypeIdx, _scoreNFTAddress, _scoreNFTTokenId, _prizeTokenAddress, _prizeTokenId, _prizeTokenAmount, deadline)
    /******************** After Claiming ********************/
    expect(await DINO.ownerOf(1)).to.equal(u1.address);
  });

  it.only("should pass Type2 test", async function () {
    const { base, admin, signer, u0, u1, prizeClaimer, scoreNFT } = await loadFixture(defaultFixture);
    const { gateway, gatewayAdmin, manager, erc1155: Coupon, erc721: DINO, erc20: DAM } = base

    this.timeout(30 * 1000);
    const startTime = 1999888777;
    const deadline = startTime + 15 * 60;

    // 1. Manager mints some scoreNFT tokens to u1 as the prizeClaimer tokens
    await gateway.connect(manager).ERC721_mint(await scoreNFT.getAddress(), u1.address, 0);
    expect(await scoreNFT.balanceOf(u1.address)).to.equal(1);

    // 2. Reset timestamp
    time.setNextBlockTimestamp(startTime);

    const _prizeTypeIdx = 1   //Type2 = BNB, 10
    const _scoreNFTAddress = await scoreNFT.getAddress()
    const _scoreNFTTokenId = 1
    const _prizeTokenAddress = "0x0000000000000000000000000000000000000000"
    const _prizeTokenId = 0
    const _prizeTokenAmount = '10000000000000000000'

    await expect(constructAndClaim(prizeClaimer, signer, u1, _prizeTypeIdx, _scoreNFTAddress, _scoreNFTTokenId, _prizeTokenAddress, _prizeTokenId, _prizeTokenAmount, deadline)).to.be.revertedWith("PrizeClaimer: Insufficient BNB balance")

    // transfer Enough BNB to prizeClaimer
    const prizeClaimerAddress = await prizeClaimer.getAddress();
    const amount = hre.ethers.parseEther("50");
    await signer.sendTransaction({
      to: prizeClaimerAddress,
      value: amount,
    });

    console.log(await hre.ethers.provider.getBalance(prizeClaimerAddress))
    const beforeAmt = await hre.ethers.provider.getBalance(u1.address)

    const tx: ContractTransactionResponse = await constructAndClaim(prizeClaimer, signer, u1, _prizeTypeIdx, _scoreNFTAddress, _scoreNFTTokenId, _prizeTokenAddress, _prizeTokenId, _prizeTokenAmount, deadline)

    const txReceipt: ContractTransactionReceipt | null = await tx.wait();


    expect(tx).to.emit(prizeClaimer, "ClaimPrize").withArgs(u1.address, _prizeTypeIdx, _scoreNFTAddress, _scoreNFTTokenId, _prizeTokenAddress, _prizeTokenId, _prizeTokenAmount);

    /******************** After Claiming ********************/
    expect(await hre.ethers.provider.getBalance(prizeClaimerAddress)).to.equal(amount - getBigInt(_prizeTokenAmount));
    const afterAmt = await hre.ethers.provider.getBalance(u1.address)

    expect(getBigInt(afterAmt)).to.equal(getBigInt(beforeAmt) + getBigInt(_prizeTokenAmount) - txReceipt!.gasPrice * txReceipt!.gasUsed)
  });

  it.only("should pass Type3-Type6 test", async function () {
    const { base, admin, signer, u0, u1, prizeClaimer, scoreNFT } = await loadFixture(defaultFixture);
    const { gateway, gatewayAdmin, manager, erc1155: Coupon, erc721: DINO, erc20: DAM } = base

    this.timeout(30 * 1000);
    const startTime = 1999888777;
    const deadline = startTime + 15 * 60;

    // 1. Manager mints some scoreNFT tokens to u1 as the prizeClaimer tokens
    await gateway.connect(manager).ERC721_mint(await scoreNFT.getAddress(), u1.address, 0);
    expect(await scoreNFT.balanceOf(u1.address)).to.equal(1);

    // 2. Reset timestamp
    time.setNextBlockTimestamp(startTime);

    const _prizeTypeIdx = 3   //Type3 = DAM 20000
    const _scoreNFTAddress = await scoreNFT.getAddress()
    const _scoreNFTTokenId = 1
    const _prizeTokenAddress = await DAM.getAddress()
    const _prizeTokenId = 0
    const _prizeTokenAmount = '20000'

    // pause transfer for DAM
    await DAM.pause()

    const tx: ContractTransactionResponse = await constructAndClaim(prizeClaimer, signer, u1, _prizeTypeIdx, _scoreNFTAddress, _scoreNFTTokenId, _prizeTokenAddress, _prizeTokenId, _prizeTokenAmount, deadline)

    const txReceipt: ContractTransactionReceipt | null = await tx.wait();

    expect(tx).to.emit(prizeClaimer, "ClaimPrize").withArgs(u1.address, _prizeTypeIdx, _scoreNFTAddress, _scoreNFTTokenId, _prizeTokenAddress, _prizeTokenId, _prizeTokenAmount);

    /******************** After Claiming ********************/

    const afterAmt = await hre.ethers.provider.getBalance(u1.address)

    expect(await DAM.balanceOf(u1.address)).to.equal(getBigInt(_prizeTokenAmount))
  });

  it.only("should pass Type7-Type12 test", async function () {
    const { base, admin, signer, u0, u1, prizeClaimer, scoreNFT } = await loadFixture(defaultFixture);
    const { gateway, gatewayAdmin, manager, erc1155: Coupon, erc721: DINO, erc20: DAM } = base

    this.timeout(30 * 1000);
    const startTime = 1999888777;
    const deadline = startTime + 15 * 60;

    // 1. Manager mints some scoreNFT tokens to u1 as the prizeClaimer tokens
    await gateway.connect(manager).ERC721_mint(await scoreNFT.getAddress(), u1.address, 0);
    expect(await scoreNFT.balanceOf(u1.address)).to.equal(1);

    // 2. Reset timestamp
    time.setNextBlockTimestamp(startTime);

    const _prizeTypeIdx = 6   //ERC1155, 1 * SSR Coupon
    const _scoreNFTAddress = await scoreNFT.getAddress()
    const _scoreNFTTokenId = 1
    const _prizeTokenAddress = await Coupon.getAddress()
    const _prizeTokenId = 1
    const _prizeTokenAmount = 1
    await constructAndClaim(prizeClaimer, signer, u1, _prizeTypeIdx, _scoreNFTAddress, _scoreNFTTokenId, _prizeTokenAddress, _prizeTokenId, _prizeTokenAmount, deadline)
    /******************** After Claiming ********************/
    expect(await Coupon.balanceOf(u1.address, _prizeTokenId)).to.equal(_prizeTokenAmount);

    await expect(constructAndClaim(prizeClaimer, signer, u1, _prizeTypeIdx, _scoreNFTAddress, _scoreNFTTokenId, _prizeTokenAddress, _prizeTokenId, _prizeTokenAmount, deadline)).to.be.revertedWith('PrizeClaimer: not qualified scoreNFT HODL to claim or this tokenid has been claimed')
  });
});
