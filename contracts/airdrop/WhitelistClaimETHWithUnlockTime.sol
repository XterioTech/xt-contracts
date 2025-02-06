// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./WhitelistClaimWithUnlockTime.sol";

contract WhitelistClaimETHWithUnlockTime is WhitelistClaimWithUnlockTime {
    constructor(
        bytes32 _merkleRoot,
        uint256 _startTime,
        uint256 _deadline
    ) WhitelistClaimWithUnlockTime(_merkleRoot, _startTime, _deadline) {}

    function _payOut(uint256 amount, address to) internal override {
        (bool success, ) = to.call{value: amount}("");
        require(success, "WhitelistClaimETHWithUnlockTime: failed to send funds");
    }

    function _withdraw(address to) internal override {
        (bool success, ) = to.call{value: address(this).balance}("");
        require(success, "WhitelistClaimETHWithUnlockTime: failed to _withdraw");
    }
}
