// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SingleCheckIn {
    mapping(address user => mapping(uint256 channel => bool checked)) records;

    event CheckIn(address indexed user, uint256 indexed channel);

    constructor() {}

    function checkIn(uint256 _channel) external {
        require(
            !records[msg.sender][_channel],
            "Already checked in for this channel."
        );
        records[msg.sender][_channel] = true;
        emit CheckIn(msg.sender, _channel);
    }

    function query(
        address _user,
        uint256 _channel
    ) external view returns (bool) {
        return records[_user][_channel];
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
