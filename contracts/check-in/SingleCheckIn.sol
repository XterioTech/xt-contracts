// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SingleCheckIn {
    mapping(address user => mapping(uint256 channel => uint256 lastCheckInTime)) records;

    event CheckIn(
        address indexed user,
        uint256 indexed channel,
        uint256 timestamp
    );

    constructor() {}

    function checkIn(uint256 _channel) external {
        records[msg.sender][_channel] = block.timestamp;
        emit CheckIn(msg.sender, _channel, block.timestamp);
    }

    function query(
        address _user,
        uint256 _channel
    ) external view returns (bool) {
        return records[_user][_channel] > 0;
    }

    function getLastCheckInTime(address _user, uint256 _channel) external view returns (uint256) {
        return records[_user][_channel];
    }

    function queryMultiChannels(
        address _user,
        uint256[] calldata _channels
    ) external view returns (bool[] memory) {
        bool[] memory results = new bool[](_channels.length);
        for (uint256 i; i < _channels.length; ) {
            results[i] = records[_user][_channels[i]] > 0;
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
            results[i] = records[_users[i]][_channel] > 0;
            unchecked {
                ++i;
            }
        }
        return results;
    }

    function getMultiChannels(
        address _user,
        uint256[] calldata _channels
    ) external view returns (uint256[] memory) {
        uint256[] memory results = new uint256[](_channels.length);
        for (uint256 i; i < _channels.length; ) {
            results[i] = records[_user][_channels[i]];
            unchecked {
                ++i;
            }
        }
        return results;
    }

    function getMultiUsers(
        address[] calldata _users,
        uint256 _channel
    ) external view returns (uint256[] memory) {
        uint256[] memory results = new uint256[](_users.length);
        for (uint256 i; i < _users.length; ) {
            results[i] = records[_users[i]][_channel];
            unchecked {
                ++i;
            }
        }
        return results;
    }
}
