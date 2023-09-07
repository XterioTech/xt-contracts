import fs from "fs";
import { ethers } from "ethers";
import { inputSimple, inputPassword2 } from "./lib/input";

const privateKey = inputSimple("Private Key: ");
const password = inputPassword2("Password: ");
const wallet = new ethers.Wallet(privateKey);
wallet.encrypt(password).then((jsonWallet) => {
  console.log("Encrypted JSON Wallet", jsonWallet);
  fs.writeFileSync(`wallet.json`, jsonWallet);
});
