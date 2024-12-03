package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// https://docs.nodereal.io/reference/nr_gettokenholders

func main() {

	noderealApiKey := "d62ceae762914167aacf5d161a05e5c5"
	url := "https://opbnb-mainnet.nodereal.io/v1/" + noderealApiKey
	tokenAddress := `"0xF4ECC1C74D120649f6598C7A217AbaFfdf76Cd4F"` // Dino Amber
	pageSize := `"0x64"`
	pageKey := `""`
	counter := 1

	csvFile, err := os.Create("result.csv")
	if err != nil {
		fmt.Println("os.Create: ", err.Error())
		return
	}
	defer csvFile.Close()

	writer := csv.NewWriter(csvFile)
	defer writer.Flush()

	for {
		time.Sleep(2 * time.Second)
		params := tokenAddress + "," + pageSize + "," + pageKey
		reader := "{\n  \"jsonrpc\": \"2.0\",\n  \"id\": 0,\n  \"method\": \"nr_getTokenHolders\",\n  \"params\": [\n    " + params + "\n  ]\n}"

		payload := strings.NewReader(reader)

		req, _ := http.NewRequest("POST", url, payload)

		req.Header.Add("Content-Type", "application/json")

	Loop:

		res, err := http.DefaultClient.Do(req)
		if err != nil {
			fmt.Println("http.DefaultClient.Do: ", err.Error())
			time.Sleep(2 * time.Second)
			goto Loop
		}

		body, err := io.ReadAll(res.Body)
		if err != nil {
			fmt.Println("io.ReadAll: ", err.Error())
			time.Sleep(2 * time.Second)
			goto Loop
		}
		res.Body.Close()

		resp := &Resp{}
		err = json.Unmarshal(body, resp)
		if err != nil {
			fmt.Println("json.Unmarshal: ", err.Error())
			time.Sleep(2 * time.Second)
			goto Loop
		}

		for _, balance := range resp.Result.Details {
			n, _ := strconv.ParseInt(balance.TokenBalance[2:], 16, 64)
			writer.Write([]string{balance.AccountAddress, strconv.Itoa(int(n))})
		}

		fmt.Println("counter:", counter)
		fmt.Println("Finished: ", pageKey)
		fmt.Println("Next: ", resp.Result.PageKey)

		if resp.Result.PageKey == "" {
			fmt.Println("Finished all!")
			break
		}
		pageKey = "\"" + resp.Result.PageKey + "\""
		counter++
	}
}

type Resp struct {
	Result Result `json:"result"`
}

type Result struct {
	PageKey string    `json:"pageKey"`
	Details []Balance `json:"details"`
}

type Balance struct {
	AccountAddress string `json:"accountAddress"`
	TokenBalance   string `json:"tokenBalance"`
}
