// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./WhitelistClaim.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract WhitelistClaimERC20 is WhitelistClaim {
    using SafeERC20 for IERC20;
    IERC20 public token;

    constructor(
        address admin,
        bytes32 _merkleRoot,
        uint256 _deadline,
        address _token
    ) WhitelistClaim(admin, _merkleRoot, _deadline) {
        token = IERC20(_token);
    }

    function _payOut(uint256 amount, address to) internal override {
        token.safeTransfer(to, amount);
    }

    function _withdraw(address to) internal override {
        token.safeTransfer(to, token.balanceOf(address(this)));
    }
}
