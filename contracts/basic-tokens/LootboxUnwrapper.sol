// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IGateway.sol";
import "./interfaces/IERC1155BurnSingle.sol";

contract LootboxUnwrapper {
    address gateway;

    constructor(address _gateway) {
        gateway = _gateway;
    }

    event UnwrapLootbox(
        address indexed recipient,
        address boxTokenAddress,
        uint256 boxTokenId,
        address indexed contentTokenAddress,
        uint256 indexed contentTokenId
    );

    function unwrapLootbox(
        address _boxTokenAddress,
        uint256 _boxTokenId,
        address _contentTokenAddress,
        uint256 _contentTokenId,
        uint256 _deadline, // 15min
        bytes calldata _sig
    ) external {
        // Check if before deadline
        require(block.timestamp <= _deadline, "LootboxUnwrapper: too late");

        // Check signature validity
        bytes32 inputHash = _getInputHash(
            msg.sender,
            _boxTokenAddress,
            _boxTokenId,
            _contentTokenAddress,
            _contentTokenId,
            _deadline
        );
        address signer = IGateway(gateway).nftManager(_contentTokenAddress);
        _checkSigValidity(inputHash, _sig, signer);

        // Burn box token
        IERC1155BurnSingle(_boxTokenAddress).burn(msg.sender, _boxTokenId, 1);

        // Mint content token
        IGateway(gateway).ERC721_mint(
            _contentTokenAddress,
            msg.sender,
            _contentTokenId
        );

        emit UnwrapLootbox(
            msg.sender,
            _boxTokenAddress,
            _boxTokenId,
            _contentTokenAddress,
            _contentTokenId
        );
    }

    function _getInputHash(
        address recipient,
        address boxTokenAddress,
        uint256 boxTokenId,
        address contentTokenAddress,
        uint256 contentTokenId,
        uint256 deadline
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    recipient,
                    boxTokenAddress,
                    boxTokenId,
                    contentTokenAddress,
                    contentTokenId,
                    deadline,
                    block.chainid
                )
            );
    }

    function _checkSigValidity(
        bytes32 inputHash,
        bytes memory sig,
        address signer
    ) internal pure {
        require(
            signer == ECDSA.recover(_getEthSignedMessageHash(inputHash), sig),
            "LootboxUnwrapper: invalid signature"
        );
    }

    function _getEthSignedMessageHash(
        bytes32 criteriaMessageHash
    ) internal pure returns (bytes32) {
        return ECDSA.toEthSignedMessageHash(criteriaMessageHash);
    }
}
