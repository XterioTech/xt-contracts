package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"math/big"
	"sort"
	"time"

	"getXterStakeInfo/contract"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

var (
	Rpc                string
	XterStakingAddress string
	DeployBlockNumber  int
	EndBlockNumber     int
	RangeBlockNumber   int
)

func init() {
	flag.StringVar(&Rpc, "rpc", "", "BlockChain rpc node")
	flag.StringVar(&XterStakingAddress, "xterStakingAddress", "", "XterStaking address")
	flag.IntVar(&DeployBlockNumber, "deployBlockNumber", 0, "The height of the block when the XterStaking is deployed")
	flag.IntVar(&EndBlockNumber, "endBlockNumber", 0, "The block height of the XterStaking snapshot")
	flag.IntVar(&RangeBlockNumber, "rangeBlockNumber", 10000, "Query the block height of the range")
	flag.Parse()
}

func main() {
	client, err := ethclient.Dial(Rpc)
	if err != nil {
		fmt.Println("ethclient.Dial", err)
		log.Fatal("ethclient.Dial", err)
	}

	xterStakingAddress := common.HexToAddress(XterStakingAddress)

	XterStakingContract, err := contract.NewContracts(xterStakingAddress, client)
	if err != nil {
		log.Println("NewContracts error: ", err)
		return
	}

	stakeHash := common.HexToHash("0x2720efa4b2dd4f3f8a347da3cbd290a522e9432da9072c5b8e6300496fdde282")
	unStakeHash := common.HexToHash("0xf74c9f1985016ff6aa83c3fd81e31d0be3b194f205ae5e1b57f5bd74ad28e4cf")
	query := ethereum.FilterQuery{
		Topics:    [][]common.Hash{{stakeHash, unStakeHash}},
		Addresses: []common.Address{xterStakingAddress},
	}

	type Stk struct {
		User      common.Address
		Id        *big.Int
		Amount    *big.Int
		StartTime *big.Int
		Duration  *big.Int
		claimed   int8
	}
	stakes := make(map[int64]*Stk)
	unStakes := make(map[int64]*Stk)

	startTime := time.Now()

	for i := DeployBlockNumber; i <= EndBlockNumber; i += RangeBlockNumber {
		fromBlock := i
		toBlock := i + RangeBlockNumber - 1
		if toBlock > EndBlockNumber {
			toBlock = EndBlockNumber
		}

		query.FromBlock = big.NewInt(int64(fromBlock))
		query.ToBlock = big.NewInt(int64(toBlock))

	Loop:
		xterStakingLogs, err := client.FilterLogs(context.Background(), query)
		if err != nil {
			log.Println("client.FilterLogs", err, "retry")
			goto Loop
		}

		log.Println("fromBlock =", fromBlock, "and toBlock =", toBlock, "have", len(xterStakingLogs), "logs")
		for _, xterStakingLog := range xterStakingLogs {
			if xterStakingLog.Topics[0] == stakeHash {
				contractsStake, err := XterStakingContract.ParseStake(xterStakingLog)
				if err != nil {
					log.Println("ParseStake error: ", err)
					return
				}
				// log.Println("stake: ", contractsStake.Id, contractsStake.Amount, contractsStake.StartTime, contractsStake.Duration, 1, contractsStake.User)
				stakes[contractsStake.Id.Int64()] = &Stk{
					Id: contractsStake.Id, Amount: contractsStake.Amount, StartTime: contractsStake.StartTime, Duration: contractsStake.Duration, claimed: 1, User: contractsStake.User,
				}
			} else {
				contractsUnStake, err := XterStakingContract.ParseUnStake(xterStakingLog)
				if err != nil {
					log.Println("ParseUnStake error: ", err)
					return
				}
				// log.Println("unStake: ", contractsUnStake.Id, contractsUnStake.Amount, contractsUnStake.StartTime, contractsUnStake.Duration, 2, contractsUnStake.User)
				unStakes[contractsUnStake.Id.Int64()] = &Stk{
					Id: contractsUnStake.Id, Amount: contractsUnStake.Amount, StartTime: contractsUnStake.StartTime, Duration: contractsUnStake.Duration, claimed: 2, User: contractsUnStake.User,
				}
			}
		}
	}

	stakesSlice := make([]Stk, 0)

	for id := range stakes {
		if _, ok := unStakes[id]; ok {
			stakes[id].claimed = unStakes[id].claimed
		}
		stakesSlice = append(stakesSlice, *stakes[id])
	}

	sort.SliceStable(stakesSlice, func(i, j int) bool {
		return stakesSlice[i].Id.Int64() < stakesSlice[j].Id.Int64()
	})

	fmt.Println("\"staking_id\",\"amount_raw\",\"start_time\",\"duration\",\"status\",\"address\"")
	for _, stk := range stakesSlice {
		fmt.Println(fmt.Sprintf("\"%d\",\"%d\",\"%d\",\"%d\",\"%d\",\"%s\"", stk.Id, stk.Amount, stk.StartTime, stk.Duration, stk.claimed, stk.User))
	}

	elapsedTime := time.Since(startTime)
	log.Println("elapsed time =", elapsedTime)
}
