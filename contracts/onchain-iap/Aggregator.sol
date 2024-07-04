// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract Aggregator is AggregatorV3Interface, Ownable {
    uint8 private _decimals;
    string private _description;
    uint256 private _version;

    struct RoundData {
        uint80 roundId;
        int256 answer;
        uint256 startedAt;
        uint256 updatedAt;
        uint80 answeredInRound;
    }

    mapping(uint80 => RoundData) private _roundData;
    uint80 private _latestRoundId;

    constructor(
        address _owner,
        uint8 decimals_,
        string memory description_,
        uint256 version_
    ) Ownable() {
        _decimals = decimals_;
        _description = description_;
        _version = version_;
        transferOwnership(_owner);
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function description() external view returns (string memory) {
        return _description;
    }

    function version() external view returns (uint256) {
        return _version;
    }

    function getRoundData(
        uint80 _roundId
    )
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        RoundData memory data = _roundData[_roundId];
        require(data.roundId > 0, "No data present");
        return (
            data.roundId,
            data.answer,
            data.startedAt,
            data.updatedAt,
            data.answeredInRound
        );
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        require(_latestRoundId > 0, "No data present");
        RoundData memory data = _roundData[_latestRoundId];
        return (
            data.roundId,
            data.answer,
            data.startedAt,
            data.updatedAt,
            data.answeredInRound
        );
    }

    function updateRoundData(
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt
    ) external onlyOwner {
        require(
            roundId > _latestRoundId,
            "Round ID must be greater than latest"
        );
        _roundData[roundId] = RoundData(
            roundId,
            answer,
            startedAt,
            updatedAt,
            roundId
        );
        _latestRoundId = roundId;
    }

    function updateAggregatorData(
        uint8 decimals_,
        string memory description_,
        uint256 version_
    ) external onlyOwner {
        _decimals = decimals_;
        _description = description_;
        _version = version_;
    }
}
