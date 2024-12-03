import csv
import requests
import json

dry_run = False
authorization = ""

input_file = ""
from_account = ""

token_id = ""
decimals = 8

# Open the csv file
with open(input_file, mode='r') as file:
    # Create a csv reader object
    csv_reader = csv.DictReader(file)
    
    # Iterate over each row in the csv file
    for row in csv_reader:
        account_id = row['account_id']
        reward = row['reward']
        
        # Call the API to transfer tokens
        url = 'https://funfog.xter.io/asset/v1/ft/tokens/balance/game/transfer'
        headers = {
            'Authorization': authorization,  # Replace with your actual authorization token
            'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
            'Content-Type': 'application/json'
        }
        payload = {
            "from_id": from_account,
            "from_type": 1,
            "to_id": account_id,
            "to_type": 2,
            "token_id": token_id,
            "amount": str(int(float(reward) * (10 ** decimals))),
            "client_id": "dinosty-airdrop-" + account_id,
            "transaction_type": 0
        }
        
        if dry_run:
            print(f'Transfer to account {account_id} - payload:')
            print(json.dumps(payload))
        else:    
            response = requests.post(url, headers=headers, json=payload)

            # Print the response status code and JSON response data
            print(f'Transfer to account {account_id} - Status Code: {response.status_code}')
            print(response.json())
