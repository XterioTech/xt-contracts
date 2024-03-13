// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../../basic-tokens/interfaces/IGateway.sol";

// Claim your Palio Egg and hatch it!
contract PalioIncubator is Ownable, ReentrancyGuardUpgradeable {
    event ClaimEgg(address indexed claimer, address nftaddress);
    event ClaimUtility(address indexed claimer, uint8 indexed utilityType);
    event ClaimChatNFT(address indexed claimer, address nftaddress, uint256 indexed chapterIndex);
    event Boost(address indexed booster, uint256 indexed chapterIndex, uint256 boostPrice);
    event Regenerate(address indexed sender, uint count);

    uint256 public constant MAX_CHAPTER = 4; // [0, 1, 2, 3]
    uint256 public constant CHAPTER_PERIOD = 7 * 24 * 60 * 60; // seconds for one chapter
    uint256 public constant DAY_PERIOD = 24 * 60 * 60; // seconds for one day
    uint256 public constant MAX_UTILITIES_PER_DAY = 3; // maximun utilities count claimed per day for each type

    uint256 public eventStartTime; // event start time

    address public gateway;
    address public payeeAddress;

    address public eggAddress;
    // whether egg has claimed for the specific address
    mapping(address => bool) public eggClaimed;
    // claimed feed utilities count, mapping from address => (day_idx, feed_type(1byte)) => count
    mapping(address => mapping(uint256 => uint256)) private _claimedUtilities;

    address public chatNFTAddress;
    // whether chat NFT has claimed for the specific address in every chapter
    mapping(address => mapping(uint256 => bool)) public chatNFTClaimed;
    
    uint256 public constant BOOST_PRICE = 0.01 ether;   
    // whether has boosted for the specific address in every chapter
    mapping(address => mapping(uint256 => bool)) public boosted;

    uint256 public constant MAX_REGENERATE = 3; // maximun Regenerate count
    mapping(address => uint256) public regenerated;

    constructor(
        address _gateway,
        address _payeeAddress,
        address _eggAddress,
        address _chatNFTAddress,
        uint256 _eventStartTime
    ) {
        eventStartTime = _eventStartTime;
        gateway = _gateway;
        payeeAddress = _payeeAddress;
        eggAddress = _eggAddress;
        chatNFTAddress = _chatNFTAddress;
    }

    function claimEgg() external nonReentrant {
        require(!eggClaimed[msg.sender], "PalioIncubator: already claimed");
        require(block.timestamp >= eventStartTime, "PalioIncubator: event not started");

        eggClaimed[msg.sender] = true;

        IGateway(gateway).ERC721_mint(eggAddress, msg.sender, 0);
        emit ClaimEgg(msg.sender, eggAddress);
    }

    function claimUtility(uint8 utilityType) external nonReentrant {
        require(eggClaimed[msg.sender], "PalioIncubator: egg not claimed yet");
        require(block.timestamp >= eventStartTime, "PalioIncubator: event not started");

        uint256 dayIdx = dayIndex();
        uint256 claimedCnt = claimedUtilities(msg.sender, utilityType, dayIdx);
        require(
            claimedCnt < MAX_UTILITIES_PER_DAY,
            "PalioIncubator: utility claim limit exceeded"
        );
        setClaimedUtilities(msg.sender, utilityType, dayIdx, claimedCnt+1);
        emit ClaimUtility(msg.sender, utilityType);
    }

    function claimChatNFT() external nonReentrant {
        uint256 _chapterIndex = chapterIndex();
        require(eggClaimed[msg.sender], "PalioIncubator: egg not claimed yet");
        require(!chatNFTClaimed[msg.sender][_chapterIndex], "PalioIncubator: already claimed in this chapter");
        require(block.timestamp >= eventStartTime, "PalioIncubator: event not started");
        require(_chapterIndex < MAX_CHAPTER, "PalioIncubator: last chapter ended");

        chatNFTClaimed[msg.sender][_chapterIndex] = true;
        IGateway(gateway).ERC1155_mint(chatNFTAddress, msg.sender, _chapterIndex, 1,  "0x");
        emit ClaimChatNFT(msg.sender, chatNFTAddress, _chapterIndex);
    }

    function boost() external payable nonReentrant {
        uint256 _chapterIndex = chapterIndex();
        require(eggClaimed[msg.sender], "PalioIncubator: egg not claimed yet");
        require(!boosted[msg.sender][_chapterIndex], "PalioIncubator: already boosted in this chapter");
        require(block.timestamp >= eventStartTime, "PalioIncubator: event not started");
        require(msg.value == BOOST_PRICE, "PalioIncubator: boost price not match");
        require(_chapterIndex < MAX_CHAPTER, "PalioIncubator: last chapter ended");

        (bool sent, ) = payeeAddress.call{value: msg.value}("");
        require(sent, "PalioIncubator: Failed to send Ether to payee");

        boosted[msg.sender][_chapterIndex] = true;
        emit Boost(msg.sender, _chapterIndex, BOOST_PRICE);
    }

    function regenerate() external payable nonReentrant {
        uint256 hasRegenerated = regenerated[msg.sender];
        require(eggClaimed[msg.sender], "PalioIncubator: egg not claimed yet");
        require(hasRegenerated < MAX_REGENERATE, "PalioIncubator: regenerate limit exceeded");
        require(block.timestamp >= eventStartTime, "PalioIncubator: event not started");
        require(msg.value == BOOST_PRICE * (hasRegenerated + 1), "PalioIncubator: regenerate price not match");

        (bool sent, ) = payeeAddress.call{value: msg.value}("");
        require(sent, "PalioIncubator: Failed to send Ether to payee");

        regenerated[msg.sender] = hasRegenerated + 1;
        emit Regenerate(msg.sender, hasRegenerated + 1);
    }

    function dayIndex() private view returns (uint256) {
        require(block.timestamp >= eventStartTime, "PalioIncubator: event not started");
        return (block.timestamp - eventStartTime) / DAY_PERIOD;
    }

    function chapterIndex() private view returns (uint256) {
        require(block.timestamp >= eventStartTime, "PalioIncubator: event not started");
        return (block.timestamp - eventStartTime) / CHAPTER_PERIOD;
    }

    function claimedUtilities(
        address user,
        uint8 utilityType,
        uint256 dayIdx
    ) public view returns (uint256) {
        uint256 flag = (dayIdx << 8) | utilityType;
        return _claimedUtilities[user][flag];
    }

    function setClaimedUtilities(
        address user,
        uint8 utilityType,
        uint256 dayIdx,
        uint256 cnt
    ) private {
        uint256 flag = (dayIdx << 8) | utilityType;
        _claimedUtilities[user][flag] = cnt;
    }

    function claimedUtilitiesToday(
        address user,
        uint8 utilityType
    ) public view returns (uint256) {
        return claimedUtilities(user, utilityType, dayIndex());
    }

    function claimedUtilitiesTodayBatch(
        address user, 
        uint8[] calldata utilityTypes
    ) public view returns (uint256[] memory) {
        uint256 dayIdx = dayIndex();
        uint256[] memory claimedCounts = new uint256[](utilityTypes.length);
        
        for (uint256 i = 0; i < utilityTypes.length; i++) {
            claimedCounts[i] = claimedUtilities(user, utilityTypes[i], dayIdx);
        }
        return claimedCounts;
    }

    function checkChapterStatus(address user) public view returns (bool chatNFTClaimedStatus, bool boostedStatus) {
        uint256 _chapterIndex = chapterIndex();
        chatNFTClaimedStatus = chatNFTClaimed[user][_chapterIndex];
        boostedStatus = boosted[user][_chapterIndex];

        return (chatNFTClaimedStatus, boostedStatus);
    }

    /************************************ Management Functions *************************************/
    function setGateway(address _gateway) external onlyOwner {
        gateway = _gateway;
    }

    function setPayeeAddress(address _payee) external onlyOwner {
        payeeAddress = _payee;
    }

    function setEggAddress(address _addr) external onlyOwner {
        eggAddress = _addr;
    }

    function setChatNFTAddress(address _addr) external onlyOwner {
        chatNFTAddress = _addr;
    }
}
