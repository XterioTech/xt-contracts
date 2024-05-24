// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ExternalERC721 is ERC721, AccessControl {
    // Role definitions
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // Base URI
    string private __baseURI;

    // Token ID counter
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    constructor(
        string memory _name,
        string memory _symbol,
        string memory baseURI,
        address _admin
    ) ERC721(_name, _symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);

        __baseURI = baseURI;
    }

    /**
     * Override {IERC721Metadata-tokenURI}.
     */
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        _requireMinted(tokenId);
        return _baseURI();
    }

    /**
     * Set the base URI of the token metadata
     * @param newURI The new base URI
     */
    function setBaseURI(string memory newURI) public onlyRole(OPERATOR_ROLE) {
        __baseURI = newURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return __baseURI;
    }

    function mintTo(address recipient) public returns (uint256) {
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _safeMint(recipient, newItemId);
        return newItemId;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
