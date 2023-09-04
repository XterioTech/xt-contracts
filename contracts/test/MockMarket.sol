// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract MockMarket {
    function transferERC721(
        address contractAddr,
        address from,
        address to,
        uint256 tokenId
    ) external {
        IERC721(contractAddr).transferFrom(from, to, tokenId);
    }
}
