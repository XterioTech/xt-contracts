import hre from "hardhat";

const main = async () => {
    const offsetAddress = "0x1111000000000000000000000000000000001111";
    const l1Address = process.env.l1Address || "";
    const offsetAddressNumber = BigInt("0x" + offsetAddress.slice(2));
    const l1AddressNumber = BigInt("0x" + l1Address.slice(2));
    const result = l1AddressNumber + offsetAddressNumber;
    const l2Address = "0x" + result.toString(16).slice(-40);
    console.log("l1Address =", hre.ethers.getAddress(l1Address));
    console.log("applyL1ToL2Alias");
    console.log("l2Address =", hre.ethers.getAddress(l2Address));

};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });