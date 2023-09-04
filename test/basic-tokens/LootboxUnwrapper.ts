import hre from "hardhat";
import { expect } from "chai";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployLootboxUnwrapper } from "../../lib/deploy";
import { nftTradingTestFixture } from "../common_fixtures";

async function defaultFixture() {
  const base = await nftTradingTestFixture();
  const lootboxUnwrapper = await deployLootboxUnwrapper(base.gateway);
  // Add whitelistMinter to the whitelist
  await base.gateway.connect(base.gatewayAdmin).addOperatorWhitelist(lootboxUnwrapper);
  const [, , , u1, u2, u3, u4, u5] = await hre.ethers.getSigners();

  return { ...base, lootboxUnwrapper, u1, u2, u3, u4, u5 };
}

describe("Test LootboxUnwrapper Contract", function () {
  it("should pass integration test", async function () {
    const { gateway, gatewayAdmin, nftManager, lootboxUnwrapper, erc1155, erc721, u1 } = await loadFixture(
      defaultFixture
    );
    const boxToken = erc1155;
    const contentToken = erc721;

    this.timeout(30 * 1000);

    const startTime = 1999888777;
    const deadline = startTime + 15 * 60;

    const numBoxes = 100;
    const boxTokenId = 1;
    const contentTokenId = 249;

    // 1. Manager mints some boxToken tokens to u1 as the lootbox tokens
    gateway.connect(nftManager).ERC1155_mint(boxToken, u1.address, boxTokenId, numBoxes, "0x");

    // 2. Add lootboxUnwrapper to the whitelist
    await gateway.connect(gatewayAdmin).addOperatorWhitelist(lootboxUnwrapper);

    // 3. User approves the lootboxUnwrapper of spending
    await boxToken.connect(u1).setApprovalForAll(lootboxUnwrapper, true);

    // 4. Reset timestamp
    time.setNextBlockTimestamp(startTime);

    // 5. NFT Manager prepares the signature
    const msgHash = hre.ethers.solidityPackedKeccak256(
      [
        "address", // recipient
        "address", // boxTokenAddress
        "uint256", // boxTokenId
        "address", // contentTokenAddress
        "uint256", // contentTokenId
        "uint256", // deadline
        "uint256", // chainid
      ],
      [
        u1.address,
        await boxToken.getAddress(),
        boxTokenId,
        await contentToken.getAddress(),
        contentTokenId,
        deadline,
        hre.network.config.chainId,
      ]
    );
    const sig = await nftManager.signMessage(hre.ethers.getBytes(msgHash));

    // 5. User unwraps the lootbox
    await lootboxUnwrapper.connect(u1).unwrapLootbox(boxToken, boxTokenId, contentToken, contentTokenId, deadline, sig);

    /******************** After Unwrapping ********************/

    expect(await boxToken.balanceOf(u1.address, boxTokenId)).to.equal(numBoxes - 1);
    expect(await contentToken.ownerOf(contentTokenId)).to.equal(u1.address);
  });
});
