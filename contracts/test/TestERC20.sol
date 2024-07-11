// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract TestERC20 is
    Ownable,
    ERC20,
    ERC20Burnable,
    ERC20Permit
{

    uint8 private _decimals;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimal
    )
        ERC20(name, symbol)
        ERC20Permit(name)
    {
        _decimals = decimal;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(
        address to,
        uint256 amount
    ) external onlyOwner {
        _mint(to, amount);
    }

}
