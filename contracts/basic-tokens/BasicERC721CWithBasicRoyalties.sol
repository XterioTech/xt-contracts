// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BasicERC721C.sol";
import "@limitbreak/creator-token-contracts/contracts/programmable-royalties/BasicRoyalties.sol";

/**
 * @title BasicERC721CWithBasicRoyalties
 * @author Libeccio Inc.
 * @notice Extension of BasicERC721C that adds basic royalties support.
 */
contract BasicERC721CWithBasicRoyalties is BasicERC721C, BasicRoyalties {
    uint256 public constant VERSION_BasicERC721CWithBasicRoyalties = 20240129;

    constructor(
        string memory name,
        string memory symbol,
        string memory baseURI,
        address gateway,
        address trustedForwarder,
        address royaltyReceiver,
        uint96 royaltyFeeNumerator,
        uint256 _maxTokenId
    )
        BasicERC721C(
            name,
            symbol,
            baseURI,
            gateway,
            trustedForwarder,
            _maxTokenId
        )
        BasicRoyalties(royaltyReceiver, royaltyFeeNumerator)
    {}

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(BasicERC721C, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function setDefaultRoyalty(
        address receiver,
        uint96 feeNumerator
    ) external onlyGatewayOrOwner {
        super._setDefaultRoyalty(receiver, feeNumerator);
    }

    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 feeNumerator
    ) external onlyGatewayOrOwner {
        super._setTokenRoyalty(tokenId, receiver, feeNumerator);
    }
}
