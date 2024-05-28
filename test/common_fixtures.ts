import hre from "hardhat";
import { deployedBytecode as CreatorTokenTransferValidatorBytecode } from "../artifacts/@limitbreak/creator-token-contracts/contracts/utils/CreatorTokenTransferValidator.sol/CreatorTokenTransferValidator.json";
import { setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployForwarder, deployGateway, deployMajorToken } from "../lib/deploy";

const defaultValidatorAddr = "0x0000721C310194CcfC01E523fc93C9cCcFa2A0Ac";
export const whitelistedOperator = "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC";

// Fixture deploying the TokenGateway and Forwarder
export const gatewayForwarderFixture = async () => {
  const [owner, gatewayAdmin] = await hre.ethers.getSigners();
  const gateway = await deployGateway(gatewayAdmin.address);
  await gateway.connect(gatewayAdmin).addManager(gatewayAdmin.address);
  const forwarder = await deployForwarder();

  return { gateway, forwarder, owner, gatewayAdmin };
};

// Fixture for testing NFT contracts
export const nftTestFixture = async () => {
  const base = await gatewayForwarderFixture();
  // Set LimitBreak CreatorTokenTransferValidator contract at certain addresses
  await setCode(defaultValidatorAddr, CreatorTokenTransferValidatorBytecode);
  const transferValidator = await hre.ethers.getContractAt("CreatorTokenTransferValidator", defaultValidatorAddr);
  await transferValidator.createOperatorWhitelist("default");
  //  cannot simulate default transfer validator's constructor func. so we deploy another one
  const TransferValidator = await hre.ethers.getContractFactory("CreatorTokenTransferValidator");
  const customValidator = await TransferValidator.deploy(base.owner.address);
  await customValidator.waitForDeployment();
  await customValidator.addOperatorToWhitelist(1, whitelistedOperator);

  const MockMarket = await hre.ethers.getContractFactory("MockMarket");
  const mockMarket = await MockMarket.deploy();
  await mockMarket.waitForDeployment();

  return { ...base, mockMarket, customValidator };
};

// Fixture for testing nft tradings, e.g. marketplace, whitelistminter, etc.
export const nftTradingTestFixture = async () => {
  const base = await nftTestFixture();

  const tokenName = "TestERC721";
  const tokenSymbol = "TE721";
  const baseURI = "https://api.test/meta/goerli";

  const [, , nftManager] = await hre.ethers.getSigners();

  const BasicERC721C = await hre.ethers.getContractFactory("BasicERC721C");
  const erc721 = await BasicERC721C.connect(nftManager).deploy(
    tokenName,
    tokenSymbol,
    baseURI,
    base.gateway,
    base.forwarder,
    10000
  );
  await erc721.waitForDeployment();

  const BasicERC1155C = await hre.ethers.getContractFactory("BasicERC1155C");
  const erc1155 = await BasicERC1155C.connect(nftManager).deploy(baseURI, base.gateway, base.forwarder);
  await erc1155.waitForDeployment();

  // // NOTE: we need to configure this on-chain!!
  // await base.gateway.connect(base.gatewayAdmin).setManagerOf(erc721, nftManager.address);
  // await base.gateway.connect(base.gatewayAdmin).setManagerOf(erc1155, nftManager.address);

  const paymentToken = await deployMajorToken(base.owner.address, base.owner.address);

  return { ...base, paymentToken, erc721, erc1155, nftManager };
};
