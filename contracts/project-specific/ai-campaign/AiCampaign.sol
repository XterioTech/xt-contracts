// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract AiCampaign is Ownable, ReentrancyGuard {
    uint256 public constant DAY_PERIOD = 24 * 60 * 60;
    uint256 public eventStartTime;
    uint256 public eventEndTime;

    mapping(address => mapping(uint256 => uint256)) private userSceneSwitches;

    // Events
    event ChatScoreClaimed(address indexed user, uint256 timestamp);
    event SceneSwitched(
        address indexed user,
        uint256 sceneId,
        uint256 timestamp
    );
    event ScoreClaimed(address indexed user, uint256 timestamp);

    constructor(uint256 _eventStartTime) {
        eventStartTime = _eventStartTime;
    }

    function dayIndex() private view returns (uint256) {
        require(
            block.timestamp >= eventStartTime,
            "AiCampaign: event not started"
        );
        return (block.timestamp - eventStartTime) / DAY_PERIOD;
    }

    modifier onlyDuringEvent() {
        require(
            block.timestamp >= eventStartTime &&
                (eventEndTime == 0 || block.timestamp <= eventEndTime),
            "AiCampaign: not within event period"
        );
        _;
    }

    /************************************ User Functions *************************************/

    function claimChatScore() external nonReentrant onlyDuringEvent {
        emit ChatScoreClaimed(msg.sender, block.timestamp);
    }

    function switchScene(
        uint256 sceneId
    ) external nonReentrant onlyDuringEvent {
        require(sceneId >= 1 && sceneId <= 28, "AiCampaign: invalid scene ID");

        uint256 todayIndex = dayIndex();
        require(
            userSceneSwitches[msg.sender][todayIndex] < 3,
            "AiCampaign: maximum switches reached for today"
        );

        userSceneSwitches[msg.sender][todayIndex]++;

        emit SceneSwitched(msg.sender, sceneId, block.timestamp);
    }

    function remainingSwitches()
        external
        view
        onlyDuringEvent
        returns (uint256)
    {
        uint256 todayIndex = dayIndex();
        return 3 - userSceneSwitches[msg.sender][todayIndex];
    }

    function claimScore() external nonReentrant onlyDuringEvent {
        emit ScoreClaimed(msg.sender, block.timestamp);
    }

    /************************************ Management Functions *************************************/

    function setEventEndTime(uint256 _eventEndTime) external onlyOwner {
        eventEndTime = _eventEndTime;
    }
}
