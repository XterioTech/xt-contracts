import hre from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployForwarder, deployGateway } from "../../lib/deploy";

describe("Test BasicERC20 Contract", function () {
  const tokenName = "TestERC20";
  const tokenSymbol = "TE20";
  const decimal = 8;
  const cap = hre.ethers.parseUnits("1000", 8);

  async function defaultFixture() {
    const [owner, gatewayAdmin, u0, u1, u2, u3, u4, u5] = await hre.ethers.getSigners();

    const gateway = await deployGateway(gatewayAdmin.address);
    await gateway.connect(gatewayAdmin).addManager(gatewayAdmin.address);
    const forwarder = await deployForwarder();

    const BasicERC20Capped = await hre.ethers.getContractFactory("BasicERC20Capped");
    const erc20 = await BasicERC20Capped.deploy(tokenName, tokenSymbol, decimal, cap, gateway, forwarder);
    await erc20.waitForDeployment();

    return { gateway, erc20, owner, gatewayAdmin, u0, u1, u2, u3, u4, u5 };
  }

  it("Cannot mint more than cap", async function () {
    const { erc20, u1, u2 } = await loadFixture(defaultFixture);
    expect(await erc20.cap()).to.equal(cap);
    await erc20.mint(u1.address, cap);
    await expect(erc20.mint(u2.address, 1)).to.be.revertedWith("ERC20Capped: cap exceeded");

    await erc20.connect(u1).burn(100);
    await erc20.mint(u2.address, 100);
    await expect(erc20.mint(u2.address, 1)).to.be.revertedWith("ERC20Capped: cap exceeded");
  });

  /********* Following cases are identical with BasicERC20 **********/

  it("Basic information", async function () {
    const { erc20 } = await loadFixture(defaultFixture);
    expect(await erc20.name()).to.equal(tokenName);
    expect(await erc20.symbol()).to.equal(tokenSymbol);
    expect(await erc20.decimals()).to.equal(decimal);
  });

  it("Mint", async function () {
    const { gateway, gatewayAdmin, erc20, u0, u1, u2, u3 } = await loadFixture(defaultFixture);

    // mint directly
    await erc20.mint(u1.address, hre.ethers.parseUnits("100", decimal));
    expect(parseInt(hre.ethers.formatUnits(await erc20.balanceOf(u1.address), decimal))).to.equal(100);
    // mint through gateway
    await gateway.ERC20_mint(erc20, u2.address, hre.ethers.parseUnits("100", decimal));
    expect(await erc20.balanceOf(u2.address)).to.equal(hre.ethers.parseUnits("100", decimal));
    // mint through gateway manager
    await gateway.connect(gatewayAdmin).setManagerOf(erc20, u0.address);
    await gateway.connect(u0).ERC20_mint(erc20, u3.address, 1);
    expect(await erc20.balanceOf(u3.address)).to.equal(1);
  });

  it("Cannot mint or transfer when paused", async function () {
    const { erc20, owner, u1, u2 } = await loadFixture(defaultFixture);

    await erc20.mint(u1.address, 1000);
    await erc20.connect(u1).transfer(u2.address, 500);

    // pause
    await erc20.pause();
    // cannot transfer when paused
    await expect(erc20.connect(u1).transfer(u2.address, 500)).to.be.revertedWith("BasicERC20: paused");
    // can mint when paused
    await erc20.connect(owner).setTransferWhitelisted("0x0000000000000000000000000000000000000000", true);
    expect(await erc20.mint(u1.address, 1000)).to.emit(erc20, "Transfer").withArgs("0x0000000000000000000000000000000000000000", u1.address, 1000);

    // unpause
    await erc20.unpause();
    await erc20.connect(u1).transfer(u2.address, 500);
  });
});
