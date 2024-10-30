// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SingleCheckIn {
    mapping(address user => mapping(uint256 channel => bool checked)) records;
    mapping(address => uint256) lastCheckInTime;

    event CheckIn(
        address indexed user,
        uint256 indexed channel,
        uint256 timestamp
    );

    constructor() {}

    function checkIn(uint256 _channel) external {
        records[msg.sender][_channel] = true;
        lastCheckInTime[msg.sender] = block.timestamp;
        emit CheckIn(msg.sender, _channel, block.timestamp);
    }

    function query(
        address _user,
        uint256 _channel
    ) external view returns (bool) {
        return records[_user][_channel];
    }

    function getLastCheckInTime(address _user) external view returns (uint256) {
        return lastCheckInTime[_user];
    }

    function queryMultiChannels(
        address _user,
        uint256[] calldata _channels
    ) external view returns (bool[] memory) {
        bool[] memory results = new bool[](_channels.length);
        for (uint256 i; i < _channels.length; ) {
            results[i] = records[_user][_channels[i]];
            unchecked {
                ++i;
            }
        }
        return results;
    }

    function queryMultiUsers(
        address[] calldata _users,
        uint256 _channel
    ) external view returns (bool[] memory) {
        bool[] memory results = new bool[](_users.length);
        for (uint256 i; i < _users.length; ) {
            results[i] = records[_users[i]][_channel];
            unchecked {
                ++i;
            }
        }
        return results;
    }
}
