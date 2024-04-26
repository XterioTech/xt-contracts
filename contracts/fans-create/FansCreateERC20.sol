// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./FansCreateCore.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// This is the fans.create contract trading with a specific ERC20 token
contract FansCreateERC20 is FansCreateCore {
    using SafeERC20 for IERC20;

    address public paymentToken;
    uint256 private _priceCoefficient;

    constructor(
        address admin,
        address signer,
        address recipient,
        string memory uri,
        address _paymentToken,
        uint256 _coefficient
    ) FansCreateCore(admin, signer, recipient, uri) {
        paymentToken = _paymentToken;
        _priceCoefficient = _coefficient;
    }

    /// @dev This virtual function should return the coefficient C of calculating the price
    ///     price(supply) = C * supply
    /// note that this coefficient should take into account the payment token's decimals, as the calculated price is considered the raw value
    function priceCoefficient()
        internal
        view
        virtual
        override
        returns (uint256)
    {
        return _priceCoefficient;
    }

    /// @dev This virtual function should check and charge trader the specified `amount` of the payment token
    function payIn(uint256 amount) internal virtual override {
        IERC20(paymentToken).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );
    }

    /// @dev This virtual function should transfer the specified `amount` of the payment token to the `to` address
    function payOut(uint256 amount, address to) internal virtual override {
        IERC20(paymentToken).safeTransfer(to, amount);
    }
}
