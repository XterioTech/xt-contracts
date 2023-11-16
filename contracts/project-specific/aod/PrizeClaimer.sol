// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "../../basic-tokens/interfaces/IGateway.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract PrizeClaimer is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum PrizeType {
        Type1, // ERC721, 1 * Dinosaur NFT
        Type2, // DAM, 2M
        Type3, // DAM, 20k
        Type4, // DAM, 1k
        Type5, // DAM, 200
        Type6, // DAM, 100
        Type7, // ERC1155, 1 * Resource Pack
        Type8, // ERC1155, 1 * NFT Coupon
        Type9, // ERC1155
        Type10, // ERC1155
        Type11, // ERC1155
        Type12 // ERC1155
    }

    address public gateway;

    address public signerAddress;

    address public scoreNFTAddress;

    // scoreNFT id => bool
    mapping(address => mapping(uint256 => bool)) hasClaimed;

    event Received(address sender, uint value);

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
        address admin,
        address _gateway,
        address _signerAddress,
        address _scoreNFTAddress
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);

        gateway = _gateway;
        signerAddress = _signerAddress;
        scoreNFTAddress = _scoreNFTAddress;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    /************************************ Management Functions *************************************/
    function setSignerAddress(address _addr) public onlyRole(OPERATOR_ROLE) {
        signerAddress = _addr;
    }

    function setScoreNFTAddress(address _addr) public onlyRole(OPERATOR_ROLE) {
        scoreNFTAddress = _addr;
    }

    function withdrawTo(
        address _to
    ) public onlyRole(DEFAULT_ADMIN_ROLE) returns (bool sent) {
        (sent, ) = _to.call{value: address(this).balance}("");
    }

    /************************************ Public Functions *************************************/
    function claimWithSig(
        uint8 _prizeTypeIdx,
        address _scoreNFTAddress,
        uint256 _scoreNFTTokenId,
        address _prizeTokenAddress,
        uint256 _prizeTokenId,
        uint256 _prizeTokenAmount,
        uint256 _deadline,
        bytes calldata _sig // Signature provided by the backend
    ) external {
        // Check if before deadline
        require(
            block.timestamp <= _deadline,
            "PrizeClaimer: signature expired"
        );

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
        _checkSigValidity(inputHash, _sig, signerAddress);

        require(
            _checkCanClaim(_scoreNFTAddress, _scoreNFTTokenId),
            "PrizeClaimer: not qualified scoreNFT HODL to claim or this tokenid has been claimed"
        );

        _awardPrize(
            _prizeTypeIdx,
            _scoreNFTAddress,
            _scoreNFTTokenId,
            _prizeTokenAddress,
            _prizeTokenId,
            _prizeTokenAmount
        );
    }

    /************************************ Internal Functions *************************************/

    function _awardPrize(
        uint8 _prizeType,
        address _scoreNFTAddress,
        uint256 _scoreNFTTokenId,
        address _prizeTokenAddress,
        uint256 _prizeTokenId,
        uint256 _prizeTokenAmount
    ) internal {
        PrizeType prize = _toPrizeType(_prizeType);

        if (prize == PrizeType.Type1) {
            require(
                _prizeTokenId == 0,
                "PrizeClaimer: _prizeTokenId is not 0 for auto-increment id for ERC721"
            );
            IGateway(gateway).ERC721_mint(_prizeTokenAddress, msg.sender, 0);
        } else if (
            prize == PrizeType.Type2 ||
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

    function _toPrizeType(uint8 value) internal pure returns (PrizeType) {
        require(
            value >= uint8(PrizeType.Type1) && value <= uint8(PrizeType.Type12),
            "Invalid prize type"
        );
        return PrizeType(value);
    }

    function _checkCanClaim(
        address _scoreNFTAddress,
        uint256 _scoreNFTTokenId
    ) internal view returns (bool) {
        (bool success, bytes memory result) = scoreNFTAddress.staticcall(
            abi.encodeWithSignature("ownerOf(uint256)", _scoreNFTTokenId)
        );
        address owner;
        if (success && result.length >= 32) {
            owner = abi.decode(result, (address));
        }

        return
            _scoreNFTAddress == scoreNFTAddress &&
            owner == msg.sender &&
            !hasClaimed[_scoreNFTAddress][_scoreNFTTokenId];
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
