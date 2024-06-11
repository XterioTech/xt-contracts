// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./WhitelistClaim.sol";

contract WhitelistClaimETH is WhitelistClaim {
    constructor(
        bytes32 _merkleRoot,
        uint256 _deadline
    ) WhitelistClaim(_merkleRoot, _deadline) {}

    function _payOut(uint256 amount, address to) internal override {
        (bool success, ) = to.call{value: amount}("");
        require(success, "WhitelistClaimETH: failed to send funds");
    }

    function _withdraw(address to) internal override {
        (bool success, ) = to.call{value: address(this).balance}("");
        require(success, "WhitelistClaimETH: failed to _withdraw");
    }
}
