// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./management/GatewayGuardedOwnable.sol";
import "./interfaces/IGateway.sol";
import "./interfaces/IBasicERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

contract BasicERC20Capped is
    IBasicERC20,
    ERC20Burnable,
    ERC20Capped,
    ERC2771Context,
    GatewayGuardedOwnable,
    Pausable
{
    uint256 public constant VERSION = 20230904;

    uint8 private _decimals;

    function _msgSender()
        internal
        view
        virtual
        override(ERC2771Context, Context)
        returns (address sender)
    {
        return ERC2771Context._msgSender();
    }

    function _msgData()
        internal
        view
        virtual
        override(ERC2771Context, Context)
        returns (bytes calldata)
    {
        return ERC2771Context._msgData();
    }

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
        ERC20(name, symbol)
        ERC20Capped(cap)
        GatewayGuarded(gateway)
        ERC2771Context(trustedForwarder)
    {
        _decimals = decimal;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(
        address to,
        uint256 amount
    ) external override onlyGatewayOrOwner {
        _mint(to, amount);
    }

    function _mint(
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Capped) {
        ERC20Capped._mint(to, amount);
    }

    function pause() external onlyGatewayOrOwner {
        _pause();
    }

    function unpause() external onlyGatewayOrOwner {
        _unpause();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}
