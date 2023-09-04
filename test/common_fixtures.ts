import hre from "hardhat";
import { deployedBytecode as CreatorTokenTransferValidatorBytecode } from "../artifacts/@limitbreak/creator-token-contracts/contracts/utils/CreatorTokenTransferValidator.sol/CreatorTokenTransferValidator.json";
import { setCode } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployForwarder, deployGateway } from "../lib/deploy";

const defaultValidatorAddr = "0x0000721C310194CcfC01E523fc93C9cCcFa2A0Ac";
export const whitelistedOperator = "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC";

export const gatewayForwarderFixture = async () => {
  const [owner, gatewayAdmin] = await hre.ethers.getSigners();
  const gateway = await deployGateway(gatewayAdmin.address);
  await gateway.connect(gatewayAdmin).addManager(gatewayAdmin.address);
  const forwarder = await deployForwarder();

  return { gateway, forwarder, owner, gatewayAdmin };
};

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
