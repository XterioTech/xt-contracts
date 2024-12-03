package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"
)

// curl https://bnb.xterscan.io/api/v2/tokens/0x1f50002614EaE2765eeF81c6e2276A3d9b69e0E5/holders

// https://bnb.xterscan.io/api/v2/tokens/0x1f50002614EaE2765eeF81c6e2276A3d9b69e0E5/holders?address_hash=0xa09ca0a2df4865c0d0be0f5e714a493c2594f70b&items_count=50&value=2117505527137729

// https://bnb.xterscan.io/api/v2/tokens/0x1f50002614EaE2765eeF81c6e2276A3d9b69e0E5/holders?address_hash=0xc2220ceff77bc1535ed300fc3cd07f00a9a321d0&items_count=100&value=1209039134730000

func main() {

	scanUrl := "https://bnb.xterscan.io/api/v2/tokens/0x1f50002614EaE2765eeF81c6e2276A3d9b69e0E5/holders"
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

	for {
	Loop:

		res, err := http.DefaultClient.Do(req)
		if err != nil {
			fmt.Println("http.NewRequest: ", err.Error())
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
			fmt.Println("json.Unmarshal: ", err.Error())
			time.Sleep(5 * time.Second)
			goto Loop
		}

		for _, item := range resp.Items {
			writer.Write([]string{item.Address.Hash, item.Value})
		}

		fmt.Println("counter:", counter)
		fmt.Println("current url:", req.URL)
		fmt.Println("resp.NextPageParams:", resp.NextPageParams)

		if resp.NextPageParams.AddressHash == "" {
			fmt.Println("Finished all!")
			break
		}

		q := url.Values{}
		q.Add("address_hash", resp.NextPageParams.AddressHash)
		q.Add("items_count", strconv.Itoa(int(resp.NextPageParams.ItemsCount)))
		q.Add("value", strconv.Itoa(int(resp.NextPageParams.Value)))
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
	Address Address `json:"address"`
	Value   string  `json:"value"`
}

type Address struct {
	Hash string `json:"hash"`
}

type NextPageParams struct {
	AddressHash string `json:"address_hash"`
	ItemsCount  int64  `json:"items_count"`
	Value       int64  `json:"value"`
}
