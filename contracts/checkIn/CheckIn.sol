// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CheckInContract {
    uint256 public constant SECONDS_IN_DAY = 86400;
    uint256 public immutable startTime;
    mapping(address user => mapping(uint256 channel => mapping(uint256 dayIndex => bool checked))) records;

    event CheckIn(
        address indexed user,
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
        address _user,
        uint256 _channel,
        uint256 _timestamp
    ) external view returns (bool) {
        if (_timestamp < startTime) {
            return false;
        }
        uint256 dayIndex = (_timestamp - startTime) / SECONDS_IN_DAY + 1;
        return records[_user][_channel][dayIndex];
    }

    function querysForUser(
        address _user,
        uint256 _channel,
        uint256[] calldata _timestamps
    ) external view returns (bool[] memory) {
        bool[] memory results = new bool[](_timestamps.length);
        for (uint256 i; i < _timestamps.length; ) {
            results[i] = this.query(_user, _channel, _timestamps[i]);
            unchecked {
                ++i;
            }
        }
        return results;
    }

    function querysForUsers(
        address[] calldata _users,
        uint256 _channel,
        uint256 _timestamp
    ) external view returns (bool[] memory) {
        bool[] memory results = new bool[](_users.length);
        for (uint256 i; i < _users.length; ) {
            results[i] = this.query(_users[i], _channel, _timestamp);
            unchecked {
                ++i;
            }
        }
        return results;
    }
}
