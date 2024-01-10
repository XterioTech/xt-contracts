// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Refund is Ownable {
    constructor(address _owner) Ownable() {
        transferOwnership(_owner);
    }

    receive() external payable {}

    function refund(
        address[] memory recipients,
        uint256[] memory amounts
    ) public onlyOwner {
        require(recipients.length == amounts.length, "Arrays length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            require(
                address(this).balance >= amounts[i],
                "Insufficient contract balance"
            );

            require(!isContract(recipients[i]), "Invalid recipient");

            (bool success, ) = recipients[i].call{value: amounts[i]}("");
            require(success, "Transfer failed");
        }
    }

    function withdraw() public onlyOwner {
        require(address(this).balance > 0, "Insufficient contract balance");
        payable(owner()).transfer(address(this).balance);
    }

    function isContract(address _address) private view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(_address)
        }
        return size > 0;
    }
}
