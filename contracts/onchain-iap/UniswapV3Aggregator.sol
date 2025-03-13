// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {TickMath} from "./libraries/TickMath.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract UniswapV3Aggregator is Ownable, AggregatorV3Interface {
    IUniswapV3Pool public uniswapV3Pool;
    uint32 public twapInterval = 3600; // 1 hour

    uint8 private _decimals;
    string private _description;
    uint256 private _version;

    constructor(
        address _uniswapV3Pool,
        address _owner,
        uint8 decimals_,
        string memory description_,
        uint256 version_
    ) Ownable() {
        _decimals = decimals_;
        _description = description_;
        _version = version_;
        transferOwnership(_owner);
        uniswapV3Pool = IUniswapV3Pool(_uniswapV3Pool);
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
        uint80
    ) external pure returns (uint80, int256, uint256, uint256, uint80) {
        return (0, 0, 0, 0, 0);
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        (
            uint160 sqrtPriceX96,
            ,
            uint16 observationIndex,
            uint16 observationCardinality,
            ,
            ,

        ) = uniswapV3Pool.slot0();

        (uint32 blockTimestamp, , , bool initialized) = uniswapV3Pool
            .observations((observationIndex + 1) % observationCardinality);
        if (!initialized) {
            (blockTimestamp, , , ) = uniswapV3Pool.observations(0);
        }

        uint32 delta = uint32(block.timestamp) - blockTimestamp;
        if (delta != 0) {
            uint32[] memory secondsAgos = new uint32[](2);
            secondsAgos[0] = twapInterval;
            secondsAgos[1] = 0;
            if (delta < twapInterval) {
                secondsAgos[0] = delta;
            }
            (int56[] memory tickCumulatives, ) = uniswapV3Pool.observe(
                secondsAgos
            );
            sqrtPriceX96 = TickMath.getSqrtRatioAtTick(
                int24(
                    (tickCumulatives[1] - tickCumulatives[0]) /
                        int56(uint56(secondsAgos[0]))
                )
            );
        }

        uint256 numerator = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        uint256 denominator = 1 << 192; // 2**96

        uint8 token0Decimals = IERC20Metadata(uniswapV3Pool.token0())
            .decimals();
        uint8 token1Decimals = IERC20Metadata(uniswapV3Pool.token1())
            .decimals();

        uint256 price;
        if (token0Decimals < token1Decimals) {
            price =
                ((numerator * 10 ** _decimals) *
                    (10 ** (token1Decimals - token0Decimals))) /
                denominator;
        } else {
            price =
                (numerator * 10 ** _decimals) /
                denominator /
                (10 ** (token0Decimals - token1Decimals));
        }

        return (0, int256(price), 0, 0, 0);
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

    function updateTwapInterval(uint32 _twapInterval) external onlyOwner {
        twapInterval = _twapInterval;
    }
}
