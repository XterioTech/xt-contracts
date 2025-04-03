// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {LaunchpoolInitializable} from "./LaunchpoolInitializable.sol";

contract LaunchpoolFactory is Ownable {
    enum Mod {
        Integrated,
        Standalone
    }

    address[] public allLaunchpools;

    event LaunchpoolCreated(
        address indexed stakingToken,
        address indexed rewardsToken,
        uint256 startTime,
        address launchpool,
        uint256 length,
        Mod mod
    );

    constructor() Ownable() {}

    function allLaunchpoolsLength() external view returns (uint256) {
        return allLaunchpools.length;
    }

    function deployLaunchpool(
        address _owner,
        address _stakingToken,
        address _rewardsToken,
        uint64 _startTime,
        uint64 _duration,
        uint256 _rewardAmount,
        Mod mod
    ) external onlyOwner {
        bytes memory bytecode = type(LaunchpoolInitializable).creationCode;
        bytes32 salt = keccak256(
            abi.encodePacked(_stakingToken, _rewardsToken, _startTime)
        );
        address launchpool;

        assembly {
            launchpool := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        require(
            launchpool != address(0),
            "LaunchpoolFactory: launchpool is zero"
        );

        LaunchpoolInitializable(launchpool).initialize(
            _owner,
            _stakingToken,
            _rewardsToken,
            _startTime,
            _duration,
            _rewardAmount
        );

        allLaunchpools.push(launchpool);

        emit LaunchpoolCreated(
            _stakingToken,
            _rewardsToken,
            _startTime,
            launchpool,
            allLaunchpools.length,
            mod
        );
    }
}
