// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IWhitelistClaimERC20 {
    function claim(uint256 amount, bytes32[] memory proof) external;
}

interface IXterStaking {
    function XTER() external view returns (IERC20);
    function stake(
        uint256 amount,
        uint256 duration,
        address _beneficiary
    ) external;
}

contract XterStakeDelegator is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IWhitelistClaimERC20 public whitelistClaim;
    IXterStaking public xterStaking;

    constructor(address _whitelistClaimERC20, address _xterStaking) {
        whitelistClaim = IWhitelistClaimERC20(_whitelistClaimERC20);
        xterStaking = IXterStaking(_xterStaking);
    }

    /**
     * @notice 用户领取空投并质押
     * @param amount 领取的数量
     * @param stakeAmount 质押的数量
     */
    function claimAndStake(
        uint256 amount,
        uint256 stakeAmount,
        uint256 duration
    ) external nonReentrant {
        require(
            stakeAmount <= amount,
            "Stake amount must be less than or equal to claim amount"
        );

        whitelistClaim.claim(amount, new bytes32[](0)); //Todo...  Merkle proof by sig

        IERC20 xterToken = IERC20(address(xterStaking.XTER()));
        xterStaking.stake(stakeAmount, duration, msg.sender);

        uint256 remainingAmount = amount - stakeAmount;
        xterToken.safeTransfer(msg.sender, remainingAmount);
    }
}
