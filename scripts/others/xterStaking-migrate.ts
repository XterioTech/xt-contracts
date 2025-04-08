import hre from "hardhat";
import * as fs from 'fs';
import * as readline from 'readline';

const main = async () => {
  const xterStaking = await hre.helpers.loadXterStaking();

  const size = Number(process.env.size) || 185;

  // 
  let stakes: any[] = [];

  let path = './scripts/others/user_stakings.csv';
  const data = fs.readFileSync(path, "utf-8");
  const lines = data.split("\n");
  lines.forEach(line => {
    let l = line.replace(/"/g, '');
    const columns = l.split(',');
    let claimed = false;
    if (Number(columns[4]) == 2) {
      claimed = true;
    }
    stakes.push({ id: columns[0], staker: columns[5], amount: columns[1], startTime: columns[2], duration: columns[3], claimed: claimed });
  });

  const result = chunkArray(stakes, size);
  console.log("result length: ", result.length);
  for (let i = 0; i < result.length; i++) {
    const migrate = await xterStaking.migrate(result[i]);
    await migrate.wait();
    console.log("tx hash:", migrate.hash);
    await sleep(5000); // 5 s
  }
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunkArray(array: any[], size: number): any[][] {
  const result: any[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
