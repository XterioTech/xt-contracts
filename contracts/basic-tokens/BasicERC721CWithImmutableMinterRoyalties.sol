// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BasicERC721C.sol";
import "@limitbreak/creator-token-contracts/contracts/programmable-royalties/ImmutableMinterRoyalties.sol";

/**
 * @title BasicERC721CWithImmutableMinterRoyalties
 * @author Libeccio Inc.
 * @notice Extension of BasicERC721C that allows for minters to receive royalties on the tokens they mint.
 *         The royalty fee is immutable and set at contract creation.
 */
contract BasicERC721CWithImmutableMinterRoyalties is
    BasicERC721C,
    ImmutableMinterRoyalties
{
    uint256 public constant VERSION_BasicERC721CWithImmutableMinterRoyalties =
        20240129;

    constructor(
        string memory name,
        string memory symbol,
        string memory baseURI,
        address gateway,
        address trustedForwarder,
        uint96 royaltyFeeNumerator,
        uint256 _maxTokenID
    )
        BasicERC721C(
            name,
            symbol,
            baseURI,
            gateway,
            trustedForwarder,
            _maxTokenID
        )
        ImmutableMinterRoyalties(royaltyFeeNumerator)
    {}

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(BasicERC721C, ImmutableMinterRoyaltiesBase)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _mint(address to, uint256 tokenId) internal virtual override {
        _onMinted(to, tokenId);
        super._mint(to, tokenId);
    }

    function _burn(uint256 tokenId) internal virtual override {
        super._burn(tokenId);
        _onBurned(tokenId);
    }
}
