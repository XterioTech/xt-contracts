// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ExternalERC1155 is ERC1155, Ownable {
    using Strings for uint256;

    constructor(string memory _uri) ERC1155(_uri) {}

    function mint(address account, uint256 id, uint256 amount) public {
        _mint(account, id, amount, "");
    }

    function burn(address account, uint256 id, uint256 amount) public {
        require(
            msg.sender == account || msg.sender == owner(),
            "caller is not the owner or the account"
        );
        _burn(account, id, amount);
    }

    /**
     * Set the base URI of the token metadata
     * @param newURI The new base URI
     */
    function setBaseURI(string memory newURI) public onlyOwner {
        _setURI(newURI);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(super.uri(tokenId), tokenId.toString()));
    }
}
