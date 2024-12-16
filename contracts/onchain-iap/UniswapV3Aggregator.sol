// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {TickMath} from "./libraries/TickMath.sol";

contract UniswapV3Aggregator is Ownable {
    IUniswapV3Pool public uniswapV3Pool;
    address public tokenAddress;
    uint8 public decimals = 18;
    uint32 public twapInterval = 3600; // 1 hour

    constructor(
        address _owner,
        address _uniswapV3Pool,
        address _tokenAddress
    ) Ownable() {
        uniswapV3Pool = IUniswapV3Pool(_uniswapV3Pool);
        tokenAddress = _tokenAddress;
        transferOwnership(_owner);
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
        uint256 denominator = 1 << 192;
        uint256 price = (numerator * 10 ** decimals) / denominator;

        if (tokenAddress != uniswapV3Pool.token0()) {
            price = 10 ** (2 * decimals) / price;
        }

        return (0, int256(price), 0, 0, 0);
    }

    function updateUniswapV3Pool(address _uniswapV3Pool) external onlyOwner {
        uniswapV3Pool = IUniswapV3Pool(_uniswapV3Pool);
    }

    function updateTokenAddress(address _tokenAddress) external onlyOwner {
        tokenAddress = _tokenAddress;
    }

    function updateDecimals(uint8 _decimals) external onlyOwner {
        decimals = _decimals;
    }

    function updateTwapInterval(uint32 _twapInterval) external onlyOwner {
        twapInterval = _twapInterval;
    }
}
