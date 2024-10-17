import hre from "hardhat";

// add key value in the .env file
//
// NFT_ADDRESS=0xF4ECC1C74D120649f6598C7A217AbaFfdf76Cd4F
// MIN_TOKEN_ID=1
// MAX_TOKEN_ID=5010
// BLOCK_HEIGHT=100000
//
// npx hardhat run scripts/others/get-nft-holders.ts --network mainnet > ./scripts/utils-go/calculateAirdropAmount/nftId-to-owner-onChain.txt
// tail -f ./scripts/utils-go/calculateAirdropAmount/nftId-to-owner-onChain.txt

const main = async () => {
    const BasicERC721C = await hre.helpers.loadBasicERC721C(process.env.NFT_ADDRESS || "");

    const min_token_id = Number(process.env.MIN_TOKEN_ID) || 0;
    const max_token_id = Number(process.env.MAX_TOKEN_ID) || 10000;
    const block_height = Number(process.env.BLOCK_HEIGHT) || "latest";

    for (let i = min_token_id; i <= max_token_id; i++) {
        try {
            let NFTIDOwnerAddress = await BasicERC721C.ownerOf(i, { blockTag: block_height });
            console.log(`${i},${NFTIDOwnerAddress}`);
        } catch (e) {
            console.log(i, e);
        }
    }
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
