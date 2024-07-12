// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// This is an ERC721 NFT contract that anyone can mint
contract TestERC721PublicMint is ERC721 {
    uint256 nextTokenId = 0;

    constructor() ERC721("Test NFT", "TNFT") {}

    function mintNext(address sender) external {
        _mint(sender, nextTokenId);
        nextTokenId++;
    }
}
