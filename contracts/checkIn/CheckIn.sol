// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CheckInContract {
    uint256 public constant SECONDS_IN_DAY = 86400;
    uint256 public immutable startTime;
    mapping(address who => mapping(uint256 channel => mapping(uint256 dayIndex => bool checked))) records;

    event CheckIn(
        address indexed who,
        uint256 indexed channel,
        uint256 dayIndex
    );

    constructor(uint256 _startTime) {
        startTime = _startTime;
    }

    function checkIn(uint256 _channel) external {
        uint256 dayIndex = (block.timestamp - startTime) / SECONDS_IN_DAY + 1;
        records[msg.sender][_channel][dayIndex] = true;
        emit CheckIn(msg.sender, _channel, dayIndex);
    }

    function query(
        address _who,
        uint256 _channel,
        uint256 _timestamp
    ) external view returns (bool) {
        require(_timestamp >= startTime, "CheckInContract: invalid timestamp");
        uint256 dayIndex = (_timestamp - startTime) / SECONDS_IN_DAY + 1;
        return records[_who][_channel][dayIndex];
    }
}
