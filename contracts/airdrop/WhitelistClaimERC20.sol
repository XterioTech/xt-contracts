// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./WhitelistClaim.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract WhitelistClaimERC20 is WhitelistClaim {
    using SafeERC20 for IERC20;
    IERC20 public immutable token;
    address public vault = address(this);

    constructor(
        bytes32 _merkleRoot,
        uint256 _startTime,
        uint256 _deadline,
        address _token,
        address _vault
    ) WhitelistClaim(_merkleRoot, _startTime, _deadline) {
        token = IERC20(_token);
        if (_vault != address(0)) {
            vault = _vault;
        }
    }

    function _payOut(uint256 amount, address to) internal override {
        if (vault == address(this)) {
            token.safeTransfer(to, amount);
        } else {
            token.safeTransferFrom(vault, to, amount);
        }
    }

    function _withdraw(address to) internal override {
        token.safeTransfer(to, token.balanceOf(address(this)));
    }

    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }
}
