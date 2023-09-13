// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BasicERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";

contract BasicERC20Capped is BasicERC20, ERC20Capped {
    uint256 public constant VERSION_BasicERC20Capped = 20230912;

    /**
     * @param gateway Gateway contract of the ERC20 contract.
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimal,
        uint256 cap,
        address gateway,
        address trustedForwarder
    )
        BasicERC20(name, symbol, decimal, gateway, trustedForwarder)
        ERC20Capped(cap)
    {}

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(BasicERC20, ERC20) {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _mint(
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Capped) {
        ERC20Capped._mint(to, amount);
    }

    function decimals()
        public
        view
        virtual
        override(BasicERC20, ERC20)
        returns (uint8)
    {
        return BasicERC20.decimals();
    }

    function _msgSender()
        internal
        view
        virtual
        override(BasicERC20, Context)
        returns (address sender)
    {
        return ERC2771Context._msgSender();
    }

    function _msgData()
        internal
        view
        virtual
        override(BasicERC20, Context)
        returns (bytes calldata)
    {
        return ERC2771Context._msgData();
    }
}
