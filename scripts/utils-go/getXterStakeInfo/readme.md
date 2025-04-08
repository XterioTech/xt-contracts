获取链上所有的质押信息

go run main.go --help
  -deployBlockNumber int
        The height of the block when the XterStaking is deployed
  -endBlockNumber int
        The block height of the XterStaking snapshot
  -rangeBlockNumber int
        Query the block height of the range (default 10000)
  -rpc string
        BlockChain rpc node
  -xterStakingAddress string
        XterStaking address


go run main.go -rpc https://xterio-testnet.alt.technology/ -xterStakingAddress 0xDC24e9e31664105b1866f8B6753896E20Bc56f59 -deployBlockNumber 5709734 -endBlockNumber 5968911 -rangeBlockNumber 1000 > testnet-user_stakings.csv

go run main.go -rpc https://xterio-fullnode.alt.technology/this-endpoint-is-not-rate-limited-please-keep-it-for-interal-use-only  -xterStakingAddress 0xC054eF315bCeAb5046848604DD98540c83Ba0B9a -deployBlockNumber 12177627 -endBlockNumber 15676868 -rangeBlockNumber 1000 > mainnet-user_stakings.csv


