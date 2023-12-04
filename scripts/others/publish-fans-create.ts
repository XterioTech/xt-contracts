import hre from "hardhat";
import { signPublishFansCreate } from "../../lib/signature";

const main = async () => {
  const [signer] = await hre.ethers.getSigners();
  const fansCreate = await hre.helpers.loadFansCreate();

  const workId = process.env.workId || 1;
  const creator = process.env.creator || "0x69c6549f5BF0Aaa1fb99DFcf8e21E5B9c90C3436";
  const ddl = new Date().getTime() + 120;

  const signerAddress = await signer.getAddress();
  const signature = await signPublishFansCreate(signer, creator, workId, 0, ddl, fansCreate.target);

  console.log("Params:", creator, workId, 1, 0, ddl, signerAddress, signature);
  const tx = await fansCreate.publishAndBuyKeys(creator, workId, 1, 0, ddl, signerAddress, signature);

  console.log("tx hash:", tx.hash);
};

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
