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
	//
	rarityToAmountMap := readFromFile("rarity-to-amount.txt")
	//
	nftIdToRarityMap := readFromFile("nftId-to-rarity.txt")
	//
	nftIdToOwnerMap := readFromFile(os.Args[1])
	//
	ownerToAirdropAmount := make(map[string]int)
	for nftId, owner := range nftIdToOwnerMap {
		rarity := nftIdToRarityMap[nftId]
		amountStr := rarityToAmountMap[rarity]
		amount, _ := strconv.Atoi(amountStr)
		ownerToAirdropAmount[owner] += amount
	}

	for owner, airdropAmount := range ownerToAirdropAmount {
		fmt.Println(owner + `,` + strconv.Itoa(airdropAmount))
	}
}

func readFromFile(fileName string) map[string]string {
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
	return results
}
