// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Launchpool is ReentrancyGuard, Ownable {
    IERC20 public immutable stakingToken;
    IERC20 public immutable rewardsToken;

    uint64 public immutable startTime;
    uint64 public immutable duration;
    uint64 public immutable finishTime;

    uint256 public lastUpdateTime;
    uint256 public getRewardTime;

    uint256 public immutable rewardAmount;
    uint256 public immutable rewardRate;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public userRewards;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event GetRewartTimeUpdate(uint256 newGetRewardTime);

    constructor(
        address _owner,
        address _stakingToken,
        address _rewardsToken,
        uint64 _startTime,
        uint64 _duration,
        uint256 _rewardAmount
    ) Ownable() {
        require(_owner != address(0), "Launchpool: owner address is zero");
        require(
            _stakingToken != address(0),
            "Launchpool: stakingToken address is zero"
        );
        require(
            _rewardsToken != address(0),
            "Launchpool: rewardsToken address is zero"
        );
        require(
            _stakingToken != _rewardsToken,
            "Launchpool: stakingToken can't equal rewardsToken"
        );
        require(_startTime > block.timestamp, "Launchpool: invalid startTime");
        require(_duration > 0, "Launchpool: invalid duration");
        require(_rewardAmount > 0, "Launchpool: invalid rewardAmount");

        transferOwnership(_owner);

        stakingToken = IERC20(_stakingToken);
        rewardsToken = IERC20(_rewardsToken);

        startTime = _startTime;
        lastUpdateTime = _startTime;

        duration = _duration;

        finishTime = _startTime + _duration;
        getRewardTime = finishTime;

        rewardAmount = _rewardAmount;
        rewardRate = _rewardAmount / _duration;
    }

    modifier updateReward(address _account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (_account != address(0)) {
            userRewards[_account] = earned(_account);
            userRewardPerTokenPaid[_account] = rewardPerTokenStored;
        }

        _;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply == 0) {
            return rewardPerTokenStored;
        }

        return
            rewardPerTokenStored +
            (rewardRate *
                (lastTimeRewardApplicable() - lastUpdateTime) *
                1e18) /
            totalSupply;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < finishTime ? block.timestamp : finishTime;
    }

    function earned(address _account) public view returns (uint256) {
        return
            ((balanceOf[_account] *
                (rewardPerToken() - userRewardPerTokenPaid[_account])) / 1e18) +
            userRewards[_account];
    }

    function stake(
        uint256 _amount
    ) public nonReentrant updateReward(msg.sender) {
        require(
            block.timestamp >= startTime,
            "Launchpool: haven't started yet"
        );
        require(_amount > 0, "Launchpool: cannot stake 0");

        totalSupply += _amount;
        balanceOf[msg.sender] += _amount;
        stakingToken.transferFrom(msg.sender, address(this), _amount);
        emit Staked(msg.sender, _amount);
    }

    function withdraw(
        uint256 _amount
    ) public nonReentrant updateReward(msg.sender) {
        require(_amount > 0, "Launchpool: cannot withdraw 0");
        require(
            balanceOf[msg.sender] >= _amount,
            "Launchpool: insufficient balance"
        );

        totalSupply -= _amount;
        balanceOf[msg.sender] -= _amount;
        stakingToken.transfer(msg.sender, _amount);
        emit Withdrawn(msg.sender, _amount);
    }

    function exit() external {
        withdraw(balanceOf[msg.sender]);
        getReward();
    }

    function getReward() public nonReentrant updateReward(msg.sender) {
        require(
            block.timestamp >= getRewardTime,
            "Launchpool: it's not get reward time yet"
        );

        uint256 reward = userRewards[msg.sender];
        if (reward > 0) {
            userRewards[msg.sender] = 0;
            rewardsToken.transfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function setGetRewardTime(uint256 _getRewardTime) external onlyOwner {
        getRewardTime = _getRewardTime;
        emit GetRewartTimeUpdate(_getRewardTime);
    }
}
