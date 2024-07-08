// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ERC721NFT is ERC721 {
    uint256 nextTokenId = 0;

    constructor() ERC721("Test NFT", "TNFT") {}

    function mintNext(address sender) external {
        _mint(sender, nextTokenId);
        nextTokenId++;
    }
}
