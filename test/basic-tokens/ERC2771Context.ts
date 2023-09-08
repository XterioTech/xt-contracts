import hre from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { nftTradingTestFixture } from "../common_fixtures";
import { Forwarder, MinimalForwarder } from "../../typechain-types";

// helper function to make code more readable
// see https://eips.ethereum.org/EIPS/eip-712 for more info

const ForwardRequest = [
  { name: "from", type: "address" },
  { name: "to", type: "address" },
  { name: "value", type: "uint256" },
  { name: "gas", type: "uint256" },
  { name: "nonce", type: "uint256" },
  { name: "data", type: "bytes" },
];

async function signTypedData(signer: Signer, chainId: bigint, verifyingContract: string, request: any) {
  return signer.signTypedData(
    {
      name: "MinimalForwarder",
      version: "0.0.1",
      chainId,
      verifyingContract,
    },
    {
      ForwardRequest,
    },
    request
  );
}

async function buildRequest(forwarder: Forwarder, input: any): Promise<MinimalForwarder.ForwardRequestStruct> {
  const nonce = await forwarder.getNonce(input.from!).then((nonce) => nonce.toString());
  return { ...input, value: "0", gas: "0xC350", nonce };
}

async function signMetaTxRequest(signer: Signer, forwarder: Forwarder, input: any) {
  const request = await buildRequest(forwarder, input);
  const chainId = await hre.ethers.provider.getNetwork().then((n) => n.chainId);
  const signature = await signTypedData(signer, chainId, await forwarder.getAddress(), request);
  return { signature, request };
}

// ----------------------------------------------------------------------------------------
// Unit tests start here
// ----------------------------------------------------------------------------------------
describe("Test ERC2771Context Contract", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function defaultFixture() {
    const base = await nftTradingTestFixture();
    const [, , , u0, u1, u2] = await hre.ethers.getSigners();

    const BasicERC20 = await hre.ethers.getContractFactory("BasicERC20");
    const erc20 = await BasicERC20.deploy("BasicERC20", "BE20", 9, base.gateway, base.forwarder);
    await erc20.waitForDeployment();

    return { ...base, erc20, u0, u1, u2 };
  }

  it("should transfer ERC20 tokens from u1 to u2 relayed by u0", async function () {
    const { erc20, forwarder, u0, u1, u2 } = await loadFixture(defaultFixture);
    const transferAmount = 1000;
    await erc20.mint(u1.address, transferAmount);

    // construct the signed payload for the relayer to accept on the end user's behalf
    const { request, signature } = await signMetaTxRequest(u1, forwarder, {
      from: u1.address,
      to: await erc20.getAddress(),
      data: erc20.interface.encodeFunctionData("transfer", [u2.address, transferAmount]),
    });

    expect(await forwarder.getNonce(request.from)).to.equal(request.nonce);
    expect(await forwarder.verify(request, signature)).to.be.true;
    const relayedTransfer = await forwarder.connect(u0).execute(request, signature);
    expect(relayedTransfer).to.emit(erc20, "Transfer").withArgs(u1.address, u2.address, transferAmount);
    expect(await erc20.balanceOf(u1)).to.equal(0);
    expect(await erc20.balanceOf(u2)).to.equal(transferAmount);
  });

  it("should transfer ERC721 token from u1 to u2 relayed by u0", async function () {
    const { erc721, forwarder, u0, u1, u2 } = await loadFixture(defaultFixture);
    const tokenId = 123;
    await erc721.mint(u1.address, tokenId);

    // construct the signed payload for the relayer to accept on the end user's behalf
    const { request, signature } = await signMetaTxRequest(u1, forwarder, {
      from: u1.address,
      to: await erc721.getAddress(),
      data: erc721.interface.encodeFunctionData("safeTransferFrom(address,address,uint256)", [
        u1.address,
        u2.address,
        tokenId,
      ]),
    });

    expect(await forwarder.getNonce(request.from)).to.equal(request.nonce);
    expect(await forwarder.verify(request, signature)).to.be.true;
    const relayedTransfer = await forwarder.connect(u0).execute(request, signature);
    expect(relayedTransfer).to.emit(erc721, "Transfer").withArgs(u1.address, u2.address, tokenId);
    expect(await erc721.ownerOf(tokenId)).to.equal(u2.address);
  });

  it("should transfer ERC1155 token from u1 to u2 relayed by u0", async function () {
    const { erc1155, forwarder, u0, u1, u2 } = await loadFixture(defaultFixture);
    const tokenId = 123;
    const transferAmount = 1;
    erc1155.mint(u1.address, tokenId, transferAmount, "0x");

    // construct the signed payload for the relayer to accept on the end user's behalf
    const { request, signature } = await signMetaTxRequest(u1, forwarder, {
      from: u1.address,
      to: await erc1155.getAddress(),
      data: erc1155.interface.encodeFunctionData("safeTransferFrom", [
        u1.address,
        u2.address,
        tokenId,
        transferAmount,
        "0x",
      ]),
    });

    expect(await forwarder.getNonce(request.from)).to.equal(request.nonce);
    expect(await forwarder.verify(request, signature)).to.be.true;
    const relayedTransfer = await forwarder.connect(u0).execute(request, signature);
    expect(relayedTransfer).to.emit(erc1155, "Transfer").withArgs(u1.address, u2.address, tokenId, transferAmount);
    expect(await erc1155.balanceOf(u1.address, tokenId)).to.equal(0);
    expect(await erc1155.balanceOf(u2.address, tokenId)).to.equal(transferAmount);
  });
});
