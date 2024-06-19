// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TokenDistribute is Ownable {
    using SafeERC20 for IERC20;

    receive() external payable {}

    constructor(address _owner) Ownable() {
        transferOwnership(_owner);
    }

    function distributeTokens(
        address tokenAddress,
        address[] memory recipients,
        uint256[] memory amounts,
        uint8 decimals,
        address sender
    ) public onlyOwner {
        uint8 tokenDecimals = (decimals > 0)
            ? decimals
            : IERC20Metadata(tokenAddress).decimals();

        require(recipients.length == amounts.length, "Arrays length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 amountWithDecimals = amounts[i] *
                (10 ** uint256(tokenDecimals));
            if (sender == address(0)) {
                IERC20(tokenAddress).safeTransfer(
                    recipients[i],
                    amountWithDecimals
                );
            } else {
                IERC20(tokenAddress).safeTransferFrom(
                    sender,
                    recipients[i],
                    amountWithDecimals
                );
            }
        }
    }

    function withdrawTokens(
        address tokenAddress,
        address _to
    ) public onlyOwner {
        IERC20 token = IERC20(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "Insufficient contract token balance");
        token.transfer(_to, balance);
    }

    function distributeETH(
        address[] memory recipients,
        uint256[] memory amounts
    ) public onlyOwner {
        require(recipients.length == amounts.length, "Arrays length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            (bool success, ) = recipients[i].call{value: amounts[i]}("");
            require(success, "Transfer failed");
        }
    }

    function withdrawETH() public onlyOwner {
        require(address(this).balance > 0, "Insufficient contract balance");
        payable(owner()).transfer(address(this).balance);
    }
}
