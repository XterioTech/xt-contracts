// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IWhitelistClaimERC20 {
    function delegateClaim(
        address beneficiary,
        uint256 amount,
        bytes32[] memory proof
    ) external;
}

interface IXterStaking {
    function XTER() external view returns (IERC20);
    function stake(
        uint256 amount,
        uint256 duration,
        address _beneficiary
    ) external;
}

contract XterStakeDelegator is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    IWhitelistClaimERC20 public whitelistClaim;
    IXterStaking public xterStaking;

    event ClaimedAndStaked(
        address indexed user,
        uint256 totalAmount,
        uint256 stakeAmount,
        uint256 withdrawAmount
    );

    constructor(address _whitelistClaimERC20, address _xterStaking) {
        whitelistClaim = IWhitelistClaimERC20(_whitelistClaimERC20);
        xterStaking = IXterStaking(_xterStaking);
    }

    /**
     * @notice User claims the airdrop and stakes
     * @param totalAmount Amount claimed
     * @param stakeAmount Amount to stake
     */
    function claimAndStake(
        uint256 totalAmount,
        bytes32[] memory proof,
        uint256 stakeAmount,
        uint256 duration
    ) external nonReentrant whenNotPaused {
        require(
            stakeAmount <= totalAmount,
            "Stake amount must be less than or equal to claim amount"
        );

        // Validate proof (this is a placeholder, implement actual proof validation)
        require(proof.length > 0, "Proof must be provided");

        // claim
        whitelistClaim.delegateClaim(msg.sender, totalAmount, proof);

        // stake
        IERC20 xterToken = IERC20(address(xterStaking.XTER()));

        xterToken.safeIncreaseAllowance(address(xterStaking), stakeAmount);

        // Check current allowance before increasing
        uint256 currentAllowance = xterToken.allowance(
            address(this),
            address(xterStaking)
        );
        require(
            currentAllowance >= stakeAmount,
            "Insufficient allowance for staking"
        );

        xterStaking.stake(stakeAmount, duration, msg.sender);

        // withdraw
        uint256 withdrawAmount = totalAmount - stakeAmount;
        if (withdrawAmount > 0) {
            xterToken.safeTransfer(msg.sender, withdrawAmount);
        }
        // Emit event for tracking
        emit ClaimedAndStaked(
            msg.sender,
            totalAmount,
            stakeAmount,
            withdrawAmount
        );
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
