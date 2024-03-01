// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";

// Claim your Palio Egg and hatch it!
contract PalioIncubator is Ownable {
    event ClaimEgg(address indexed claimer);
    event ClaimUtility(address indexed claimer, uint8 indexed utilityType);

    uint256 public constant CHAPTER_PERIOD = 7 * 24 * 60 * 60; // seconds for one chapter
    uint256 public constant DAY_PERIOD = 24 * 60 * 60; // seconds for one day
    uint256 public constant MAX_UTILITIES_PER_DAY = 3; // maximun utilities count claimed per day for each type

    uint256 public eventStartTime; // event start time

    // whether egg has claimed for the specific address
    mapping(address => bool) public eggClaimed;
    // claimed feed utilities count, mapping from address => (day_idx, feed_type(1byte)) => count
    mapping(address => mapping(uint256 => uint256)) private _claimedUtilities;

    constructor(uint256 _eventStartTime) {
        eventStartTime = _eventStartTime;
    }

    function claimEgg() external {
        require(!eggClaimed[msg.sender], "PalioIncubator: already claimed");
        require(
            block.timestamp >= eventStartTime,
            "PalioIncubator: event not started"
        );
        eggClaimed[msg.sender] = true;
        emit ClaimEgg(msg.sender);
    }

    function claimUtility(uint8 utilityType) external {
        require(eggClaimed[msg.sender], "PalioIncubator: egg not claimed yet");
        uint256 dayIdx = dayIndex();
        uint256 claimedCnt = claimedUtilities(msg.sender, utilityType, dayIdx);
        require(
            claimedCnt < MAX_UTILITIES_PER_DAY,
            "PalioIncubator: utility claim limit exceeded"
        );
        setClaimedUtilities(msg.sender, utilityType, dayIdx, claimedCnt+1);
        emit ClaimUtility(msg.sender, utilityType);
    }

    function dayIndex() private view returns (uint256) {
        require(
            block.timestamp >= eventStartTime,
            "PalioIncubator: event not started"
        );
        return (block.timestamp - eventStartTime) / DAY_PERIOD;
    }

    function chapterIndex() private view returns (uint256) {
        require(
            block.timestamp >= eventStartTime,
            "PalioIncubator: event not started"
        );
        return (block.timestamp - eventStartTime) / CHAPTER_PERIOD;
    }

    function claimedUtilities(
        address user,
        uint8 utilityType,
        uint256 dayIdx
    ) public view returns (uint256) {
        uint256 flag = (dayIdx << 8) & utilityType;
        return _claimedUtilities[user][flag];
    }

    function claimedUtilitiesToday(
        address user,
        uint8 utilityType
    ) public view returns (uint256) {
        return claimedUtilities(user, utilityType, dayIndex());
    }

    function setClaimedUtilities(
        address user,
        uint8 utilityType,
        uint256 dayIdx,
        uint256 cnt
    ) private {
        uint256 flag = (dayIdx << 8) & utilityType;
        _claimedUtilities[user][flag] = cnt;
    }
}
