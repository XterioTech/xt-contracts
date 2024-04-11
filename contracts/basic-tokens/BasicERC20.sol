// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./interfaces/IGateway.sol";
import "./interfaces/IBasicERC20.sol";
import "./management/GatewayGuardedOwnable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

contract BasicERC20 is
    IBasicERC20,
    ERC20,
    ERC20Burnable,
    ERC20Permit,
    ERC2771Context,
    GatewayGuardedOwnable,
    Pausable
{

    event SetTransferWhitelisted(address addr, bool whitelisted);

    uint256 public constant VERSION_BasicERC20 = 20240320;

    uint8 private _decimals;

    mapping(address => bool) public transferWhitelisted;

    /**
     * @param gateway Gateway contract of the ERC20 contract.
     */
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimal,
        address gateway,
        address trustedForwarder
    )
        ERC20(name, symbol)
        ERC20Permit(name)
        ERC2771Context(trustedForwarder)
        GatewayGuarded(gateway)
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

    function pause() external onlyGatewayOrOwner {
        _pause();
    }

    function unpause() external onlyGatewayOrOwner {
        _unpause();
    }

    function setTransferWhitelisted(address addr, bool whitelisted) external onlyGatewayOrOwner {
        transferWhitelisted[addr] = whitelisted;
        emit SetTransferWhitelisted(addr, whitelisted);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (paused()) {
            require(transferWhitelisted[from] || transferWhitelisted[to], "BasicERC20: paused");
        }
        super._beforeTokenTransfer(from, to, amount);
    }

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
}
