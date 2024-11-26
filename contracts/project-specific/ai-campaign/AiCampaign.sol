// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AiCampaign is Ownable {
    uint256 public constant DAY_PERIOD = 24 * 60 * 60;
    uint256 public eventStartTime;
    uint256 public eventEndTime;

    // Events
    event ChatScoreClaimed(
        address indexed user,
        uint256 walletType,
        uint256 timestamp
    );
    event SceneSwitched(
        address indexed user,
        uint256 sceneId,
        uint256 walletType,
        uint256 timestamp
    );
    event TaskScoreClaimed(
        address indexed user,
        uint256 taskId,
        uint256 walletType,
        uint256 timestamp
    );

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

    function claimChatScore(uint256 walletType) external onlyDuringEvent {
        emit ChatScoreClaimed(msg.sender, walletType, block.timestamp);
    }

    function switchScene(
        uint256 sceneId,
        uint256 walletType
    ) external onlyDuringEvent {
        require(sceneId >= 1 && sceneId <= 28, "AiCampaign: invalid scene ID");
        emit SceneSwitched(msg.sender, sceneId, walletType, block.timestamp);
    }

    function claimTaskScore(
        uint256 taskId,
        uint256 walletType
    ) external onlyDuringEvent {
        emit TaskScoreClaimed(msg.sender, taskId, walletType, block.timestamp);
    }

    /************************************ Management Functions *************************************/

    function setEventEndTime(uint256 _eventEndTime) external onlyOwner {
        eventEndTime = _eventEndTime;
    }
}
