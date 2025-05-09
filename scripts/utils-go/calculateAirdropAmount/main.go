package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
)

func main() {
	log.Println("Start calculate...")
	defer log.Println("End calculate!")
	//
	rarityToAmountMap := readFromFile("rarity-to-amount.txt")
	//
	nftIdToRarityMap := readFromFile("nftId-to-rarity.txt")
	//
	nftIdToOwnerMap := readFromFile(os.Args[1])
	//
	ownerToAirdropAmount := make(map[string]int)
	for nftId, owner := range nftIdToOwnerMap {
		// 通过 nft id 查询稀有度
		rarity := nftIdToRarityMap[nftId]
		// 通过稀有度查询空投数量
		amountStr := rarityToAmountMap[rarity]
		amount, _ := strconv.Atoi(amountStr)
		// 累计当前 owner 的空投数量
		ownerToAirdropAmount[owner] += amount
	}

	for owner, airdropAmount := range ownerToAirdropAmount {
		fmt.Println(owner + `,` + strconv.Itoa(airdropAmount))
	}
}

func readFromFile(fileName string) map[string]string {
	log.Println("Open and read", fileName, "file...")
	defer log.Println("Read", fileName, "finished!")

	results := make(map[string]string)
	rarityToAmountFile, err := os.Open(fileName)
	if err != nil {
		log.Fatal(err)
	}
	scanner := bufio.NewScanner(rarityToAmountFile)
	for scanner.Scan() {
		fields := strings.Split(scanner.Text(), ",")
		results[fields[0]] = fields[1]
	}
	if err := scanner.Err(); err != nil {
		log.Fatal(err)
	}
	log.Println(fileName, "has", len(results), "lines.")
	return results
}
