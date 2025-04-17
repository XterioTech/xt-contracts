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

    uint256 public poolStakeLimit;
    uint256 public userStakeLimit;
    uint256 public lastUpdateTime;
    uint128 public getRewardTime;
    uint128 public withdrawTime;

    uint256 public immutable rewardAmount;
    uint256 public immutable rewardRate;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public userRewardDebt;
    mapping(address => uint256) public userRewardPaid;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event XPoolStake(address indexed user, uint256 amount);
    event XPoolWithdraw(address indexed user, uint256 amount);
    event XPoolGetReward(address indexed user, uint256 reward);
    event XPoolAddRewardAmount(uint256 rewardAmount);

    event XPoolUpdateGetRewartTime(uint128 getRewardTime);
    event XPoolUpdateWithdrawTime(uint128 withdrawTime);
    event XPoolUpdateStakeLimit(uint256 poolStakeLimit, uint256 userStakeLimit);
    event XPoolWithdrawERC20Token(
        address tokenAddress,
        address recipient,
        uint256 tokenAmount
    );

    constructor(
        address _owner,
        address _stakingToken,
        address _rewardsToken,
        uint64 _startTime,
        uint64 _duration,
        uint256 _rewardAmount,
        uint256 _poolStakeLimit,
        uint256 _userStakeLimit
    ) Ownable() {
        require(_owner != address(0), "Launchpool: owner address is zero");
        require(
            _stakingToken != address(0),
            "Launchpool: stakingToken address is zero"
        );
        require(
            _stakingToken != _rewardsToken,
            "Launchpool: stakingToken can't equal rewardsToken"
        );
        require(_startTime > block.timestamp, "Launchpool: invalid startTime");
        require(_duration > 0, "Launchpool: invalid duration");
        require(_rewardAmount > 0, "Launchpool: invalid rewardAmount");
        require(_poolStakeLimit > 0, "Launchpool: invalid poolStakeLimit");
        require(_userStakeLimit > 0, "Launchpool: invalid userStakeLimit");

        transferOwnership(_owner);

        stakingToken = IERC20(_stakingToken);
        rewardsToken = IERC20(_rewardsToken);

        startTime = _startTime;
        lastUpdateTime = _startTime;

        duration = _duration;

        finishTime = _startTime + _duration;
        getRewardTime = finishTime;
        withdrawTime = finishTime;

        rewardAmount = _rewardAmount;
        rewardRate = _rewardAmount / _duration;

        poolStakeLimit = _poolStakeLimit;
        userStakeLimit = _userStakeLimit;
    }

    modifier updateReward(address _account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (_account != address(0)) {
            userRewardDebt[_account] = earned(_account);
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
            userRewardDebt[_account];
    }

    function stake(
        uint256 _amount
    ) public nonReentrant updateReward(msg.sender) {
        require(
            block.timestamp >= startTime,
            "Launchpool: haven't started yet"
        );
        require(_amount > 0, "Launchpool: can't stake 0");

        totalSupply += _amount;
        require(
            totalSupply <= poolStakeLimit,
            "Launchpool: exceed pool stake limit"
        );

        balanceOf[msg.sender] += _amount;
        require(
            balanceOf[msg.sender] <= userStakeLimit,
            "Launchpool: exceed user stake limit"
        );
        stakingToken.transferFrom(msg.sender, address(this), _amount);

        emit XPoolStake(msg.sender, _amount);
    }

    function withdraw(
        uint256 _amount
    ) public nonReentrant updateReward(msg.sender) {
        require(
            block.timestamp >= withdrawTime,
            "Launchpool: it's not withdraw time yet"
        );
        require(_amount > 0, "Launchpool: can't withdraw 0");
        require(
            balanceOf[msg.sender] >= _amount,
            "Launchpool: insufficient balance"
        );

        totalSupply -= _amount;
        balanceOf[msg.sender] -= _amount;
        stakingToken.transfer(msg.sender, _amount);

        emit XPoolWithdraw(msg.sender, _amount);
    }

    function exit() external {
        withdraw(balanceOf[msg.sender]);
        getReward(userRewardDebt[msg.sender]);
    }

    function getReward(
        uint256 _amount
    ) public nonReentrant updateReward(msg.sender) {
        require(
            address(rewardsToken) != address(0),
            "Launchpool: rewardsToken address is zero, can't getReward"
        );
        require(
            block.timestamp >= getRewardTime,
            "Launchpool: it's not get reward time yet"
        );

        uint256 reward = userRewardDebt[msg.sender];
        require(reward >= _amount, "Launchpool: insufficient reward");

        userRewardDebt[msg.sender] -= _amount;
        userRewardPaid[msg.sender] += _amount;
        rewardsToken.transfer(msg.sender, _amount);

        emit XPoolGetReward(msg.sender, _amount);
    }

    function addRewardAmount() external onlyOwner {
        rewardsToken.transferFrom(msg.sender, address(this), rewardAmount);
        emit XPoolAddRewardAmount(rewardAmount);
    }

    function updateGetRewardTime(uint128 _getRewardTime) external onlyOwner {
        getRewardTime = _getRewardTime;

        emit XPoolUpdateGetRewartTime(_getRewardTime);
    }

    function updateWithdrawTime(uint128 _withdrawTime) external onlyOwner {
        withdrawTime = _withdrawTime;

        emit XPoolUpdateWithdrawTime(_withdrawTime);
    }

    function updateStakeLimit(
        uint256 _poolStakeLimit,
        uint256 _userStakeLimit
    ) external onlyOwner {
        poolStakeLimit = _poolStakeLimit;
        userStakeLimit = _userStakeLimit;

        emit XPoolUpdateStakeLimit(_poolStakeLimit, _userStakeLimit);
    }

    function withdrawERC20Token(
        address _tokenAddress,
        address _recipient,
        uint256 _tokenAmount
    ) external onlyOwner {
        IERC20(_tokenAddress).transfer(_recipient, _tokenAmount);

        emit XPoolWithdrawERC20Token(_tokenAddress, _recipient, _tokenAmount);
    }
}
