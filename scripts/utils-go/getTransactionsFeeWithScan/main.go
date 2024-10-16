package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"
)

// https://bnb.xterscan.io/api/v2/addresses/0x93f7d9dF604f14e85f49317c550fee06a5CDeB2E/transactions

// https://bnb.xterscan.io/api/v2/addresses/0x93f7d9dF604f14e85f49317c550fee06a5CDeB2E/transactions?block_number=2011690&fee=132579000000&hash=0x3b336025131f300bd5579e38bbb8acb9625ff14205dec517ec7a6308566decc4&index=1&inserted_at=2024-08-19T21%3A43%3A52.843112Z&items_count=50&value=0

// https://bnb.xterscan.io/api/v2/addresses/0x93f7d9dF604f14e85f49317c550fee06a5CDeB2E/transactions?block_number=2010500&fee=132579000000&hash=0x20646ff33912a18e731437562b9681784c31ad5a45a759607bd46ad2ea591349&index=1&inserted_at=2024-08-19T21%3A44%3A02.105249Z&items_count=100&value=0

func main() {

	scanUrl := "https://bnb.xterscan.io/api/v2/addresses/0x93f7d9dF604f14e85f49317c550fee06a5CDeB2E/transactions"
	counter := 1

	csvFile, err := os.Create("result.csv")
	if err != nil {
		fmt.Println("os.Create: ", err.Error())
		return
	}
	defer csvFile.Close()

	writer := csv.NewWriter(csvFile)
	defer writer.Flush()

	req, err := http.NewRequest("GET", scanUrl, nil)
	if err != nil {
		fmt.Println("http.NewRequest: ", err.Error())
		return
	}

	AllTransactionFee := big.NewInt(0)

	for {
	Loop:
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			fmt.Println("http.NewRequest: ", err.Error(), req.URL.String())
			time.Sleep(5 * time.Second)
			goto Loop
		}

		body, err := io.ReadAll(res.Body)
		if err != nil {
			fmt.Println("io.ReadAll: ", err.Error())
			time.Sleep(5 * time.Second)
			goto Loop
		}
		res.Body.Close()

		resp := &Result{}
		err = json.Unmarshal(body, resp)
		if err != nil {
			fmt.Println("json.Unmarshal: ", err.Error(), string(body))
			time.Sleep(5 * time.Second)
			goto Loop
		}

		for _, item := range resp.Items {
			value, _ := big.NewInt(0).SetString(item.Fee.Value, 10)
			AllTransactionFee = AllTransactionFee.Add(AllTransactionFee, value)
			writer.Write([]string{item.Hash, item.GasUsed, item.GasPrice, item.Fee.Value, AllTransactionFee.String()})
		}

		fmt.Println("counter:", counter)
		fmt.Println("current url:", req.URL)
		fmt.Println("resp.NextPageParams:", resp.NextPageParams)

		if resp.NextPageParams.Hash == "" {
			fmt.Println("Finished all!")
			break
		}

		q := url.Values{}
		q.Add("block_number", strconv.Itoa(int(resp.NextPageParams.BlockNumber)))
		q.Add("fee", resp.NextPageParams.Fee)
		q.Add("hash", resp.NextPageParams.Hash)
		q.Add("inserted_at", resp.NextPageParams.InsertedAt)
		q.Add("index", strconv.Itoa(int(resp.NextPageParams.Index)))
		q.Add("items_count", strconv.Itoa(int(resp.NextPageParams.ItemsCount)))
		q.Add("value", resp.NextPageParams.Value)

		req.URL.RawQuery = q.Encode()
		fmt.Println("next url:", req.URL)
		fmt.Println("===")
		counter++
	}
}

type Result struct {
	Items          []Item         `json:"items"`
	NextPageParams NextPageParams `json:"next_page_params"`
}

type Item struct {
	Fee      Fee    `json:"fee"`
	Hash     string `json:"hash"`
	GasPrice string `json:"gas_price"`
	GasUsed  string `json:"gas_used"`
}

type Fee struct {
	Value string `json:"value"`
}

type NextPageParams struct {
	BlockNumber int64  `json:"block_number"`
	Fee         string `json:"fee"`
	Hash        string `json:"hash"`
	Index       int64  `json:"index"`
	InsertedAt  string `json:"inserted_at"`
	ItemsCount  int64  `json:"items_count"`
	Value       string `json:"value"`
}
