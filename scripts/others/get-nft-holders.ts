import hre from "hardhat";

// add message in the .env file
//
// NFT_ADDRESS=0xF4ECC1C74D120649f6598C7A217AbaFfdf76Cd4F
// MIN_TOKEN_ID=1
// MAX_TOKEN_ID=5010
//
// npx hardhat run scripts/others/get-nft-holders.ts --network mainnet > result.csv

const main = async () => {
    const BasicERC721C = await hre.helpers.loadBasicERC721C(process.env.NFT_ADDRESS || "");

    const min_token_id = Number(process.env.MIN_TOKEN_ID) || 0;
    const max_token_id = Number(process.env.MAX_TOKEN_ID) || 10000;

    for (let i = min_token_id; i <= max_token_id; i++) {
        try {
            let NFTIDOwnerAddress = await BasicERC721C.ownerOf(i);
            console.log(i, ",", NFTIDOwnerAddress);
        } catch (e) {
            // console.log(i, e);
        }
    }
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
