// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract ERC1155NFT is ERC1155 {
    constructor() ERC1155("uri") {}

    function mintTo(address account, uint256 id, uint256 amount) public {
        _mint(account, id, amount, "");
    }
}
