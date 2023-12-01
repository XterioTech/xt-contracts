// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./FansCreateCore.sol";

// This is the fans.create contract trading with native BNB token
contract FansCreate is FansCreateCore {
    // Mark the payment token as native BNB token
    address public constant paymentToken = address(0);

    constructor(address admin, string memory uri) FansCreateCore(admin, uri) {}

    /// @dev This virtual function should return the coefficient C of calculating the price
    ///     price(supply) = C * supply * supply
    /// note that this coefficient should take into account the payment token's decimals, as the calculated price is considered the raw value
    function priceCoefficient()
        internal
        view
        virtual
        override
        returns (uint256)
    {
        // 1BNB / 1250
        return 800000000000000;
    }

    /// @dev This virtual function should check and charge trader the specified `amount` of the payment token
    function payIn(uint256 amount) internal virtual override {
        require(msg.value >= amount, "FansCreate: insufficient payment");
        if (msg.value > amount) {
            payOut(msg.value - amount, msg.sender);
        }
    }

    /// @dev This virtual function should transfer the specified `amount` of the payment token to the `to` address
    function payOut(uint256 amount, address to) internal virtual override {
        (bool success, ) = to.call{value: amount}("");
        require(success, "FansCreate: failed to send funds");
    }
}
