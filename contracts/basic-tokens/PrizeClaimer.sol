// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "./interfaces/IGateway.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PrizeClaimer {
    using SafeERC20 for IERC20;

    enum PrizeType {
        Type1, // ERC721, 1 * Dinosaur NFT
        Type2, // BNB, 10
        Type3, // DAM, 20k
        Type4, // DAM, 1k
        Type5, // DAM, 200
        Type6, // DAM, 100
        Type7, // ERC1155, 1 * Resource Pack
        Type8, // ERC1155, 1 * SSR Coupon
        Type9, // ERC1155, 1 * SR Coupon
        Type10, // ERC1155, 1 * R Coupon
        Type11, // ERC1155, 1 * A Coupon
        Type12 // ERC1155, 1 * B Coupon
    }

    address public gateway;

    address public signer_address;

    address public scoreNFTAddress;

    // scoreNFT id => bool
    mapping(address => mapping(uint256 => bool)) hasClaimed;

    event Received(address Sender, uint Value);

    event ClaimPrize(
        address indexed recipient,
        uint8 indexed _prizeType,
        address _scoreNFTAddress,
        uint256 _scoreNFTTokenId,
        address indexed _prizeTokenAddress,
        uint256 _prizeTokenId,
        uint256 _prizeTokenAmount
    );

    constructor(
        address _gateway,
        address _signer_address,
        address _scoreNFTAddress
    ) {
        gateway = _gateway;
        signer_address = _signer_address;
        scoreNFTAddress = _scoreNFTAddress;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    function awardPrize(
        uint8 _prizeType,
        address _scoreNFTAddress,
        uint256 _scoreNFTTokenId,
        address _prizeTokenAddress,
        uint256 _prizeTokenId,
        uint256 _prizeTokenAmount
    ) public payable {
        PrizeType prize = _toPrizeType(_prizeType);

        if (prize == PrizeType.Type1) {
            require(
                _prizeTokenId == 0,
                "PrizeClaimer: _prizeTokenId is not 0 for auto-increment id for ERC721"
            );
            IGateway(gateway).ERC721_mint(_prizeTokenAddress, msg.sender, 0);
        } else if (prize == PrizeType.Type2) {
            require(
                _prizeTokenAddress == address(0),
                "PrizeClaimer: _prizeTokenAddress is not Native token 0x00"
            );
            require(
                address(this).balance >= _prizeTokenAmount,
                "PrizeClaimer: Insufficient BNB balance"
            );
            address payeeAddress = msg.sender;
            (bool sent, ) = payeeAddress.call{value: _prizeTokenAmount}("");
            require(sent, "PrizeClaimer: Failed to send Ether to claimer");
        } else if (
            prize == PrizeType.Type3 ||
            prize == PrizeType.Type4 ||
            prize == PrizeType.Type5 ||
            prize == PrizeType.Type6
        ) {
            IGateway(gateway).ERC20_mint(
                _prizeTokenAddress,
                msg.sender,
                _prizeTokenAmount
            );
        } else if (
            prize == PrizeType.Type7 ||
            prize == PrizeType.Type8 ||
            prize == PrizeType.Type9 ||
            prize == PrizeType.Type10 ||
            prize == PrizeType.Type11 ||
            prize == PrizeType.Type12
        ) {
            IGateway(gateway).ERC1155_mint(
                _prizeTokenAddress,
                msg.sender,
                _prizeTokenId,
                _prizeTokenAmount,
                "0x"
            );
        } else {
            revert("Unknown prize type");
        }

        hasClaimed[_scoreNFTAddress][_scoreNFTTokenId] = true;

        emit ClaimPrize(
            msg.sender,
            _prizeType,
            _scoreNFTAddress,
            _scoreNFTTokenId,
            _prizeTokenAddress,
            _prizeTokenId,
            _prizeTokenAmount
        );
    }

    function _toPrizeType(uint8 value) private pure returns (PrizeType) {
        require(
            value >= uint8(PrizeType.Type1) && value <= uint8(PrizeType.Type10),
            "Invalid prize type"
        );
        return PrizeType(value);
    }

    function claimWithSig(
        uint8 _prizeTypeIdx,
        address _scoreNFTAddress,
        uint256 _scoreNFTTokenId,
        address _prizeTokenAddress,
        uint256 _prizeTokenId,
        uint256 _prizeTokenAmount,
        uint256 _deadline,
        bytes calldata _sig // Signature provided by the backend
    ) external payable {
        // Check if before deadline
        require(block.timestamp <= _deadline, "PrizeClaimer: too late");

        // Check signature validity
        bytes32 inputHash = _getInputHash(
            _prizeTypeIdx,
            _scoreNFTAddress,
            _scoreNFTTokenId,
            _prizeTokenAddress,
            _prizeTokenId,
            _prizeTokenAmount,
            _deadline
        );
        _checkSigValidity(inputHash, _sig, signer_address);

        require(
            _scoreNFTAddress == scoreNFTAddress &&
                !hasClaimed[_scoreNFTAddress][_scoreNFTTokenId],
            "PrizeClaimer: not qualified scoreNFT HODL to claim or this tokenid has been claimed"
        );

        awardPrize(
            _prizeTypeIdx,
            _scoreNFTAddress,
            _scoreNFTTokenId,
            _prizeTokenAddress,
            _prizeTokenId,
            _prizeTokenAmount
        );
    }

    function _getInputHash(
        uint8 _prizeTypeIdx,
        address _scoreNFTAddress,
        uint256 _scoreNFTTokenId,
        address _prizeTokenAddress,
        uint256 _prizeTokenId,
        uint256 _prizeTokenAmount,
        uint256 _deadline
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    _prizeTypeIdx,
                    _scoreNFTAddress,
                    _scoreNFTTokenId,
                    _prizeTokenAddress,
                    _prizeTokenId,
                    _prizeTokenAmount,
                    _deadline,
                    block.chainid
                )
            );
    }

    function _checkSigValidity(
        bytes32 hash,
        bytes memory sig,
        address signer
    ) internal pure {
        require(
            signer == ECDSA.recover(_getEthSignedMessageHash(hash), sig),
            "PrizeClaimer: invalid signature"
        );
    }

    function _getEthSignedMessageHash(
        bytes32 criteriaMessageHash
    ) internal pure returns (bytes32) {
        return ECDSA.toEthSignedMessageHash(criteriaMessageHash);
    }
}
