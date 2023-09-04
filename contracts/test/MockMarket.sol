// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract MockMarket {
    function transferERC721(
        address contractAddr,
        address from,
        address to,
        uint256 tokenId
    ) external {
        IERC721(contractAddr).transferFrom(from, to, tokenId);
    }

    function transferERC1155(
        address contractAddr,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) external {
        IERC1155(contractAddr).safeTransferFrom(from, to, tokenId, amount, "");
    }
}
