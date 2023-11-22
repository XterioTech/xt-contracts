//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ScoreNFT is ERC721, AccessControl {
    using Strings for uint256;
    using Counters for Counters.Counter;

    enum Model {
        Dino,
        MechPal
    }

    enum Rarity {
        Common, // free mint
        Rare, // mint fee = 0.001 BNB
        Legend // mint fee = 0.01 BNB, it will gradually increase with the increase of the amount of minted
    }

    struct ScoreNFTAttributes {
        uint256 tokenid;
        Model model;
        Rarity rarity;
        uint256 score;
        uint256 minted_timestamp;
    }

    // Role definitions
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    uint256 public rareMintFee;

    uint256 public legendMintFee;

    Counters.Counter private _tokenIds;

    string private __baseURI;

    address private _signer_address;

    address private _mechPal_address;

    address private _rare_ticket_address;

    bool private _freeRareMint;

    uint256 private _maxFreeRareMintCntPerAddr;

    mapping(uint256 => ScoreNFTAttributes) public nftAttributes;

    mapping(address => uint256) public _lastTimeFreeRareMint;

    mapping(address => uint256) public totalFreeRareMint;

    // minter => minted tokenids by this minter
    mapping(address => uint256[]) public mintedTokenIds;

    // minter => minted tokens' metadata by this minter
    mapping(address => ScoreNFTAttributes[]) public mintedTokenDetails;

    // minter => total cost
    mapping(address => uint256) public minterTotalCost;

    event Received(address sender, uint value);

    event MintScoreNFT(
        address indexed receipent,
        uint256 indexed tokenid,
        uint256 indexed mintFee,
        ScoreNFTAttributes attributes
    );

    /**
     * Only allow transfer.
     */
    modifier notTransferable() {
        require(false, "ScoreNFT: not transferable");
        _;
    }

    constructor(
        string memory name,
        string memory symbol,
        string memory baseURI,
        address admin,
        address signer_address,
        address mechPal_address,
        address rare_ticket_address
    ) ERC721(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);

        __baseURI = baseURI;

        _signer_address = signer_address;
        // for free rare-mint
        _mechPal_address = mechPal_address;
        _maxFreeRareMintCntPerAddr = 10;
        _freeRareMint = true;
        // for rare-ticket mint
        _rare_ticket_address = rare_ticket_address;
        //
        rareMintFee = 1000000000000000; // 0.001 Ether in Wei
        legendMintFee = 10000000000000000; // 0.01 Ether in Wei
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    /************************************ Management Functions *************************************/
    function withdrawTo(
        address _to
    ) public onlyRole(DEFAULT_ADMIN_ROLE) returns (bool sent) {
        (sent, ) = _to.call{value: address(this).balance}("");
    }

    function setURI(string calldata _uri) external onlyRole(OPERATOR_ROLE) {
        __baseURI = _uri;
    }

    function setNewSignerAddress(address _addr) public onlyRole(OPERATOR_ROLE) {
        _signer_address = _addr;
    }

    function setFreeRareMint(bool _free) public onlyRole(OPERATOR_ROLE) {
        _freeRareMint = _free;
    }

    function setMechPalAddress(address _addr) public onlyRole(OPERATOR_ROLE) {
        _mechPal_address = _addr;
    }

    function setRareTicketAddress(
        address _addr
    ) public onlyRole(OPERATOR_ROLE) {
        _rare_ticket_address = _addr;
    }

    function setRareMintFee(uint256 fee) external onlyRole(OPERATOR_ROLE) {
        rareMintFee = fee;
    }

    function setLegendMintFee(uint256 fee) external onlyRole(OPERATOR_ROLE) {
        legendMintFee = fee;
    }

    /************************************ Internal Functions *************************************/

    function _issueScoreNFT(
        address _to,
        uint8 modelIdx,
        uint8 rarityIdx,
        uint256 score,
        uint256 mintFee
    ) internal returns (uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();

        nftAttributes[newTokenId] = ScoreNFTAttributes({
            tokenid: newTokenId,
            model: _modelIdxToModel(modelIdx),
            rarity: _rarityIdxToRarity(rarityIdx),
            score: score,
            minted_timestamp: block.timestamp
        });

        _safeMint(_to, newTokenId);
        mintedTokenIds[_to].push(newTokenId);
        mintedTokenDetails[_to].push(nftAttributes[newTokenId]);

        emit MintScoreNFT(
            msg.sender,
            newTokenId,
            mintFee,
            nftAttributes[newTokenId]
        );

        return newTokenId;
    }

    function _rarityIdxToRarity(
        uint8 rarityIdx
    ) private pure returns (Rarity rarity) {
        require(
            rarityIdx >= uint8(Rarity.Common) &&
                rarityIdx <= uint8(Rarity.Legend),
            "Invalid rarity"
        );

        rarity = Rarity(rarityIdx);
    }

    function _modelIdxToModel(
        uint8 modelIdx
    ) private pure returns (Model model) {
        require(
            modelIdx >= uint8(Model.Dino) && modelIdx <= uint8(Model.MechPal),
            "Invalid model"
        );

        model = Model(modelIdx);
    }

    function _getInputHash(
        uint8 _modelIdx,
        uint8 _rarityIdx,
        uint256 _score,
        uint256 _deadline
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    _modelIdx,
                    _rarityIdx,
                    _score,
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
            "ScoreNFT: invalid signature"
        );
    }

    function _getEthSignedMessageHash(
        bytes32 criteriaMessageHash
    ) internal pure returns (bytes32) {
        return ECDSA.toEthSignedMessageHash(criteriaMessageHash);
    }

    /************************************ Public Functions *************************************/
    function checkCanFreeMint(address minter) public view returns (bool) {
        (bool success, bytes memory result) = _mechPal_address.staticcall(
            abi.encodeWithSignature("balanceOf(address)", minter)
        );
        uint256 balance = 0;
        if (success && result.length >= 32) {
            balance = abi.decode(result, (uint256));
        }

        return
            _freeRareMint &&
            balance > 0 &&
            block.timestamp - _lastTimeFreeRareMint[minter] >= 1 days &&
            totalFreeRareMint[minter] < _maxFreeRareMintCntPerAddr;
    }

    function checkCanMintWithRareTicket(
        address minter
    ) public view returns (bool) {
        // default _rare_ticket_address use token_id = 1
        (bool success, bytes memory result) = _rare_ticket_address.staticcall(
            abi.encodeWithSignature("balanceOf(address,uint256)", minter, 1)
        );
        uint256 balance = 0;
        if (success && result.length >= 32) {
            balance = abi.decode(result, (uint256));
        }

        return balance > 0;
    }

    function rarityToString(Rarity rarity) public pure returns (string memory) {
        if (rarity == Rarity.Common) {
            return "Common";
        } else if (rarity == Rarity.Rare) {
            return "Rare";
        } else if (rarity == Rarity.Legend) {
            return "Legend";
        } else {
            revert("Invalid rarity");
        }
    }

    function modelToString(Model model) public pure returns (string memory) {
        if (model == Model.Dino) {
            return "Dino";
        } else if (model == Model.MechPal) {
            return "MechPal";
        } else {
            revert("Invalid model");
        }
    }

    function mintScoreNFT(
        uint8 _modelIdx,
        uint8 _rarityIdx,
        uint256 _score,
        uint256 _deadline,
        bytes calldata _sig // Signature provided by the backend
    ) external payable {
        // Check if before deadline
        require(block.timestamp <= _deadline, "ScoreNFT: too late");

        // Check signature validity
        bytes32 inputHash = _getInputHash(
            _modelIdx,
            _rarityIdx,
            _score,
            _deadline
        );

        _checkSigValidity(inputHash, _sig, _signer_address);

        // Calculate rarity
        Rarity rarity = _rarityIdxToRarity(_rarityIdx);

        // Calculate mint fee based on rarity
        uint256 mintFee;
        if (rarity == Rarity.Rare) {
            if (checkCanFreeMint(msg.sender)) {
                _lastTimeFreeRareMint[msg.sender] = block.timestamp;
                totalFreeRareMint[msg.sender]++;
            } else if (checkCanMintWithRareTicket(msg.sender)) {
                // ToDo... Transfer ERC1155 to _signer_address
                IERC1155(_rare_ticket_address).safeTransferFrom(
                    msg.sender,
                    _signer_address,
                    1,
                    1,
                    ""
                );
            } else {
                mintFee = rareMintFee;
            }
        } else if (rarity == Rarity.Legend) {
            mintFee = legendMintFee;
        }
        require(msg.value >= mintFee, "ScoreNFT: insufficient payment");
        // ToDo...
        // address payeeAddress = _signer_address;
        address payeeAddress = address(this);
        (bool sent, ) = payeeAddress.call{value: mintFee}("");
        require(sent, "ScoreNFT: failed to sent ether");

        // mint
        _issueScoreNFT(msg.sender, _modelIdx, _rarityIdx, _score, mintFee);

        // for invite dividend
        minterTotalCost[msg.sender] += mintFee;
    }

    function totalMinted() external view returns (uint256) {
        return _tokenIds.current();
    }

    function getMintedTokenIds(
        address user
    ) external view returns (uint256[] memory) {
        return mintedTokenIds[user];
    }

    function getMintedTokenDetails(
        address user
    ) external view returns (ScoreNFTAttributes[] memory) {
        return mintedTokenDetails[user];
    }

    /**
     * Override {IERC721Metadata-tokenURI}.
     */
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        _requireMinted(tokenId);

        ScoreNFTAttributes memory attr = nftAttributes[tokenId];

        return
            string(
                abi.encodePacked(
                    __baseURI,
                    "?tokenid=",
                    tokenId.toString(),
                    "&model_idx=",
                    uint256(attr.model).toString(),
                    "&rarity_idx=",
                    uint256(attr.rarity).toString(),
                    "&score=",
                    attr.score.toString()
                )
            );
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {IERC721-transferFrom}.
     */
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override notTransferable {
        //solhint-disable-next-line max-line-length
        require(
            _isApprovedOrOwner(_msgSender(), tokenId),
            "ERC721: transfer caller is not owner nor approved"
        );

        _transfer(from, to, tokenId);
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override notTransferable {
        safeTransferFrom(from, to, tokenId, "");
    }

    /**
     * @dev See {IERC721-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) public override notTransferable {
        require(
            _isApprovedOrOwner(_msgSender(), tokenId),
            "ERC721: transfer caller is not owner nor approved"
        );
        _safeTransfer(from, to, tokenId, _data);
    }
}
