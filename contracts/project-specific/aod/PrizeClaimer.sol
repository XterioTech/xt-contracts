// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
import "../../basic-tokens/interfaces/IGateway.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract PrizeClaimer is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum PrizeType {
        Type1, // Mining
        Type2, // Chest
        Type3, // MiniGame
        Type4  // DogTagNFT
    }

    address private hammerNftAddress;
    address private dogtagNftAddress;

    uint256 private dogtagCurrentTokenId;
    uint256 private maxMintAmount;

    address public gateway;
    address public signerAddress;
    address private payeeAddress;

    mapping(address => uint256[]) public mintedOpenIds;
    mapping(address => uint32) public mintedTimes;
    mapping(uint256 => bool) public openIdMintedStatus;

    event Received(address sender, uint value);

    event ClaimPrize(
        address indexed recipient,
        uint16 indexed _prizeType,
        uint256 indexed _prizeOpenId,
        uint256 _prizeMultiplier,
        uint256 _prizePayFee,
        address _prizeNftAddress,
        uint256 _prizeNftTokenId,
        uint256 _prizeNftAmount,
        address _prizeDamAddress,
        uint256 _prizeDamAmount,
        address _prizeDioAddress,
        uint256 _prizeDioAmount
    );

    constructor(
        address admin,
        address _gateway,
        address _signerAddress,
        address _payeeAddress,
        address _hammerNftAddress,
        address _dogtagNftAddress
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);

        gateway = _gateway;
        signerAddress = _signerAddress;
        payeeAddress = _payeeAddress;
        hammerNftAddress = _hammerNftAddress;
        dogtagNftAddress = _dogtagNftAddress;

        maxMintAmount = 5000000000000; // 50000 DAM/DIO
        dogtagCurrentTokenId = 0;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }


    /************************************ Management Functions *************************************/
    function setSignerAddress(address _addr) public onlyRole(OPERATOR_ROLE) {
        signerAddress = _addr;
    }

    function setPayeeAddress(address _addr) public onlyRole(OPERATOR_ROLE) {
        payeeAddress = _addr;
    }

    function setMaxMintAmount(uint256 _amount) public onlyRole(OPERATOR_ROLE) {
        maxMintAmount = _amount;
    }

    function withdrawTo(
        address _to
    ) public onlyRole(DEFAULT_ADMIN_ROLE) returns (bool sent) {
        (sent, ) = _to.call{value: address(this).balance}("");
    }


    /************************************ Public Functions *************************************/

    function claimWithSig(
        uint16 _prizeTypeIdx,
        uint256 _prizeOpenId,
        uint16 _prizeMultiplier,
        uint256 _prizePayFee,
        address _prizeNftAddress,
        uint256 _prizeNftTokenId,
        uint256 _prizeNftAmount,
        address _prizeDamAddress,
        uint256 _prizeDamAmount,
        address _prizeDioAddress,
        uint256 _prizeDioAmount,
        uint32 _deadline,
        bytes calldata _sig // Signature provided by the backend
    ) external payable {
        // Check if before deadline
        require(
            block.timestamp <= _deadline,
            "PrizeClaimer: signature expired"
        );

        require(!openIdMintedStatus[_prizeOpenId], "OpenID has been used");

        require(
            _prizeDamAmount <= maxMintAmount && _prizeDioAmount <= maxMintAmount,
            "Exceed Max Amount"
        );

        // Check signature validity
        bytes32 inputHash = _getInputHash(
            _prizeTypeIdx,
            _prizeOpenId,
            _prizeMultiplier,
            _prizePayFee,
            _prizeNftAddress,
            _prizeNftTokenId,
            _prizeNftAmount,
            _prizeDamAddress,
            _prizeDamAmount,
            _prizeDioAddress,
            _prizeDioAmount,
            _deadline
        );
        _checkSigValidity(inputHash, _sig, signerAddress);

        if (_prizePayFee > 0) {
            // address payeeAddress = address(this);
            (bool sent, ) = payeeAddress.call{value: _prizePayFee}("");
            require(sent, "Failed to sent fee");
        }
        
        _awardPrize(
            _prizeTypeIdx,
            _prizeOpenId,
            _prizeMultiplier,
            _prizePayFee,
            _prizeNftAddress,
            _prizeNftTokenId,
            _prizeNftAmount,
            _prizeDamAddress,
            _prizeDamAmount,
            _prizeDioAddress,
            _prizeDioAmount
        );
    }

    function claimDogtagNft() external {

        require(mintedTimes[msg.sender] < 1, "Already Minted");

        dogtagCurrentTokenId = dogtagCurrentTokenId + 1;

        mintedTimes[msg.sender] = mintedTimes[msg.sender] + 1;

        IGateway(gateway).ERC721_mint(
                    dogtagNftAddress,
                    msg.sender,
                    dogtagCurrentTokenId
                );

    }

    function getMintedOpenIds(
        address user
    ) external view returns (uint256[] memory) {
        return mintedOpenIds[user];
    }

    function checkOpenIdMinted(
        uint256 openid
    ) external view returns (bool) {
        if (openIdMintedStatus[openid]) {
            return true;
        } else {
            return false;
        }
    }

    function checkCanMintWithHammerNft(
        address minter
    ) public view returns (bool) {
        // default hammerNftAddress use token_id = 1
        (bool success, bytes memory result) = hammerNftAddress.staticcall(
            abi.encodeWithSignature("balanceOf(address,uint256)", minter, 1)
        );
        uint256 balance = 0;
        if (success && result.length >= 32) {
            balance = abi.decode(result, (uint256));
        }

        return balance > 0;
    }

    function setHammerNftAddress(
        address _addr
    ) public onlyRole(OPERATOR_ROLE) {
        hammerNftAddress = _addr;
    }

    function setDogTagNftAddress(
        address _addr
    ) public onlyRole(OPERATOR_ROLE) {
        dogtagNftAddress = _addr;
    }

    function setDogTagTokenIds(
        uint256 _tokenId
    ) public onlyRole(OPERATOR_ROLE) {
        dogtagCurrentTokenId = _tokenId;
    }
    

    /************************************ Internal Functions *************************************/

    function _awardPrize(
        uint16 _prizeType,
        uint256 _prizeOpenId,
        uint256 _prizeMultiplier,
        uint256 _prizePayFee,
        address _prizeNftAddress,
        uint256 _prizeNftTokenId,
        uint256 _prizeNftAmount,
        address _prizeDamAddress,
        uint256 _prizeDamAmount,
        address _prizeDioAddress,
        uint256 _prizeDioAmount
    ) internal {
        PrizeType prize = _toPrizeType(_prizeType);
        // 1 - Mining: _prizeMultiplier = 1, _prizePayFee = 0, _prizeNftAmount = 0
        // 2 - Chest
        // 3 - MiniGame: _prizePayFee = 0

        if (prize == PrizeType.Type1) {

            if (_prizeDamAmount > 0) {
                IGateway(gateway).ERC20_mint(
                    _prizeDamAddress,
                    msg.sender,
                    _prizeDamAmount
                );
            }

            if (_prizeDioAmount > 0) {
                IGateway(gateway).ERC20_mint(
                    _prizeDioAddress,
                    msg.sender,
                    _prizeDioAmount
                );
            }

        } else if (
            prize == PrizeType.Type2 ||
            prize == PrizeType.Type3
        )
        {
            if (_prizeMultiplier == 1 && prize == PrizeType.Type3) {
                // Check Hammer NFT to Multiple

                if (checkCanMintWithHammerNft(msg.sender)) {
                    // Transfer ERC1155 to signerAddress
                    IERC1155(hammerNftAddress).safeTransferFrom(
                        msg.sender,
                        signerAddress,
                        1,
                        1,
                        ""
                    );

                    _prizeMultiplier = 200;
                    _prizeDamAmount = _prizeDamAmount * _prizeMultiplier;
                    _prizeDioAmount = _prizeDioAmount * _prizeMultiplier;
                }
            }
         
            if (_prizeNftAmount > 0) {
                IGateway(gateway).ERC1155_mint(
                    _prizeNftAddress,
                    msg.sender,
                    _prizeNftTokenId,
                    _prizeNftAmount,
                    "0x"
                );
            }
            if (_prizeDamAmount > 0) {
                IGateway(gateway).ERC20_mint(
                    _prizeDamAddress,
                    msg.sender,
                    _prizeDamAmount
                );
            }
            if (_prizeDioAmount > 0) {
                IGateway(gateway).ERC20_mint(
                    _prizeDioAddress,
                    msg.sender,
                    _prizeDioAmount
                );
            }

        } else {
            revert("Unknown prize type");
        }

        // Update Status
        mintedOpenIds[msg.sender].push(_prizeOpenId);
        openIdMintedStatus[_prizeOpenId] = true;

        emit ClaimPrize(
            msg.sender,
            _prizeType,
            _prizeOpenId,
            _prizeMultiplier,
            _prizePayFee,
            _prizeNftAddress,
            _prizeNftTokenId,
            _prizeNftAmount,
            _prizeDamAddress,
            _prizeDamAmount,
            _prizeDioAddress,
            _prizeDioAmount
        );
    }

    function _toPrizeType(uint16 value) internal pure returns (PrizeType) {
        require(
            value >= uint16(PrizeType.Type1) && value <= uint16(PrizeType.Type3),
            "Invalid prize type"
        );
        return PrizeType(value);
    }

    function _getInputHash(
        uint16 _prizeTypeIdx,
        uint256 _prizeOpenId,
        uint16 _prizeMultiplier,
        uint256 _prizePayFee,
        address _prizeNftAddress,
        uint256 _prizeNftTokenId,
        uint256 _prizeNftAmount,
        address _prizeDamAddress,
        uint256 _prizeDamAmount,
        address _prizeDioAddress,
        uint256 _prizeDioAmount,
        uint32 _deadline
    ) internal returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    _prizeTypeIdx,
                    _prizeOpenId,
                    _prizeMultiplier,
                    _prizePayFee,
                    _prizeNftAddress,
                    _prizeNftTokenId,
                    _prizeNftAmount,
                    _prizeDamAddress,
                    _prizeDamAmount,
                    _prizeDioAddress,
                    _prizeDioAmount,
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