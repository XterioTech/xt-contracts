import hre from "hardhat";
import { expect } from "chai";
import { deployCheckIn } from "../../lib/deploy";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
describe("CheckIn", function () {
    const SECONDS_IN_DAY = 86400;
    const gameChannel = 1;
    const tgChannel = 2;
    async function basicFixture() {
        const [deployer, user1, user2] = await hre.ethers.getSigners();
        const startTime = 1726012800; // 2024-09-11 08:00:00 china
        const checkIn = await deployCheckIn(startTime);

        return { user1, user2, checkIn, startTime };
    }

    describe("Deploy", function () {
        it("Should deploy ok", async function () {
            const { checkIn, startTime } = await loadFixture(basicFixture);

            expect(await checkIn.startTime()).to.equal(startTime);
            expect(await checkIn.SECONDS_IN_DAY()).to.equal(SECONDS_IN_DAY);
        });
    });

    describe("CheckIn", function () {
        it("CheckIn in game or tg", async function () {
            const { user1, user2, checkIn, startTime } = await loadFixture(basicFixture);

            const currentBlock = await hre.ethers.provider.getBlock("latest");
            const currentTime = currentBlock?.timestamp || 0;
            console.log("currnet block timestamp: ", currentTime);

            await checkIn.connect(user1).checkIn(gameChannel);

            expect(await checkIn.query(await user1.getAddress(), gameChannel, currentTime)).to.equal(true);
            let timestamp1 = startTime + 60 * 60 * 5; // 使用过了 5 小时的时间戳查询
            expect(await checkIn.query(await user1.getAddress(), gameChannel, timestamp1)).to.equal(true);
            timestamp1 = startTime + 60 * 60 * 10; // 使用过了 10 小时的时间戳查询
            expect(await checkIn.query(await user1.getAddress(), gameChannel, timestamp1)).to.equal(true);
            timestamp1 = startTime + 60 * 60 * 23; // 使用过了 23 小时的时间戳查询
            expect(await checkIn.query(await user1.getAddress(), gameChannel, timestamp1)).to.equal(true);

            // use error channel
            expect(await checkIn.query(await user1.getAddress(), tgChannel, timestamp1)).to.equal(false);

            timestamp1 = startTime + 60 * 60 * 24; // 使用过了 24 小时的时间戳查询
            expect(await checkIn.query(await user1.getAddress(), gameChannel, timestamp1)).to.equal(false);

            timestamp1 = startTime - 60 * 60 * 1; // 使用过去 1 小时的时间戳查询，即前一天时间
            await expect(checkIn.query(await user1.getAddress(), gameChannel, timestamp1)).to.revertedWith("CheckInContract: invalid timestamp");
            //

            await checkIn.connect(user2).checkIn(tgChannel);

            expect(await checkIn.query(await user2.getAddress(), tgChannel, currentTime)).to.equal(true);
            timestamp1 = startTime + 60 * 60 * 5; // 使用过了 5 小时的时间戳查询
            expect(await checkIn.query(await user2.getAddress(), tgChannel, timestamp1)).to.equal(true);
            timestamp1 = startTime + 60 * 60 * 10; // 使用过了 10 小时的时间戳查询
            expect(await checkIn.query(await user2.getAddress(), tgChannel, timestamp1)).to.equal(true);
            timestamp1 = startTime + 60 * 60 * 23; // 使用过了 23 小时的时间戳查询
            expect(await checkIn.query(await user2.getAddress(), tgChannel, timestamp1)).to.equal(true);

            // use error channel
            expect(await checkIn.query(await user1.getAddress(), gameChannel, timestamp1)).to.equal(true);

            timestamp1 = startTime + 60 * 60 * 24; // 使用过了 24 小时的时间戳查询
            expect(await checkIn.query(await user2.getAddress(), tgChannel, timestamp1)).to.equal(false);

            timestamp1 = startTime - 60 * 60 * 1; // 使用过去 1 小时的时间戳查询，即前一天时间
            await expect(checkIn.query(await user2.getAddress(), tgChannel, timestamp1)).to.revertedWith("CheckInContract: invalid timestamp");
        });
    });
});