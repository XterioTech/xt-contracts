// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract XterStaking is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // Token interface
    IERC20Upgradeable public XTER;

    // Available tiers with their multipliers
    enum Tier {
        Tier24M, // 24 months, multiplier 4.5
        Tier12M, // 12 months, multiplier 2.0
        Tier6M, // 6 months, multiplier 0.75
        Tier3M // 3 months, multiplier 0.25
    }

    enum Status {
        UnClaimed, // 0 - 未领取
        Claimed // 1 - 已领取
    }

    // Staking structure
    struct Stk {
        uint256 id; // Unique identifier for each stake
        address staker; // Address of the staker
        uint256 amount; // Amount staked
        Tier tier; // Staking tier
        uint256 startTime; // Staking start time
        uint256 endTime; // Time when unstaking is allowed
        Status status; // UnClaimed or Claimed
    }

    // Store user stakes
    Stk[] public stakes;

    mapping(address => uint256[]) public userStakes; // Mapping from user address to their stake record IDs

    event Stake(
        address indexed user,
        uint256 indexed id,
        uint256 amount,
        uint256 startTime,
        uint256 endTime,
        Status status
    );

    event UnStake(
        address indexed user,
        uint256 indexed id,
        uint256 amount,
        uint256 startTime,
        uint256 endTime,
        Status status
    );

    event ReStake(
        address indexed user,
        uint256 indexed id,
        uint256 claimAmount,
        uint256 restakeAmount,
        uint256 startTime,
        uint256 endTime,
        Status status
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address admin,
        address xterToken
    ) public virtual initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);

        require(xterToken != address(0), "Invalid token address");
        XTER = IERC20Upgradeable(xterToken);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

    /**
     * @notice User to stake
     * @param amount Amount to stake
     * @param tier Staking tier
     */
    function stake(
        uint256 amount,
        Tier tier,
        address _beneficiary
    ) public whenNotPaused nonReentrant {
        require(amount > 0, "Stake amount must be greater than zero");

        XTER.safeTransferFrom(msg.sender, address(this), amount);

        uint256 endTime = block.timestamp + getTierDuration(tier);

        address staker = _beneficiary != address(0) ? _beneficiary : msg.sender; // 提取 staker

        stakes.push(
            Stk({
                id: stakes.length,
                staker: staker,
                amount: amount,
                tier: Tier(tier),
                startTime: block.timestamp,
                endTime: endTime,
                status: Status.UnClaimed
            })
        );

        userStakes[staker].push(stakes.length - 1); // 保存 staker 的 stake 记录 ID

        emit Stake(
            staker,
            stakes.length - 1,
            amount,
            block.timestamp,
            endTime,
            Status.UnClaimed
        );
    }

    /**
     * @notice User to unstake
     * @param _id Stake record ID
     */
    function unstake(uint256 _id) public whenNotPaused nonReentrant {
        Stk storage stakeData = stakes[_id];

        require(stakeData.staker == msg.sender, "Not authorized");
        require(
            stakeData.status == Status.UnClaimed,
            "Stake not valid or already claimed"
        );
        require(block.timestamp >= stakeData.endTime, "Stake period not ended");

        stakeData.status = Status.Claimed; // Set to ended and claimed status

        XTER.safeTransfer(msg.sender, stakeData.amount);

        emit UnStake(
            msg.sender,
            _id,
            stakeData.amount,
            stakeData.startTime,
            stakeData.endTime,
            stakeData.status
        );
    }

    /**
     * @notice User can claim part of their stake and restake
     * @param _id Stake record ID
     * @param tier New staking tier
     */
    function claimAndReStake(
        uint256 _id,
        uint256 restakeAmount,
        Tier tier
    ) external whenNotPaused nonReentrant {
        Stk storage stakeData = stakes[_id];

        require(stakeData.staker == msg.sender, "Not authorized");
        require(
            stakeData.status == Status.UnClaimed,
            "Stake not ended or already claimed"
        );
        require(
            restakeAmount <= stakeData.amount,
            "Restake amount exceeds total stake"
        );

        uint256 claimAmount = stakeData.amount - restakeAmount;

        stakeData.status = Status.Claimed;

        XTER.safeTransfer(msg.sender, claimAmount);

        stake(restakeAmount, tier, address(0));

        emit ReStake(
            msg.sender,
            _id,
            claimAmount,
            restakeAmount,
            stakeData.startTime,
            stakeData.endTime,
            stakeData.status
        );
    }

    /**
     * @notice Get duration for a specific tier (in seconds)
     * @param tier The tier to query
     */
    function getTierDuration(Tier tier) internal pure returns (uint256) {
        if (tier == Tier.Tier24M) return 24 * 30 days;
        if (tier == Tier.Tier12M) return 12 * 30 days;
        if (tier == Tier.Tier6M) return 6 * 30 days;
        if (tier == Tier.Tier3M) return 3 * 30 days;

        revert("Invalid tier");
    }

    /**
     * @notice Get total staked amount
     */
    function totalStaked() external view returns (uint256 total) {
        for (uint i = 0; i < stakes.length; i++) {
            total += stakes[i].amount;
        }
    }

    /**
     * @notice Get total staked amount for a specific user
     * @param user User address
     */
    function getUserTotalStaked(
        address user
    ) external view returns (uint256 total) {
        for (uint i = 0; i < userStakes[user].length; i++) {
            total += stakes[userStakes[user][i]].amount;
        }
    }

    /**
     * @notice Get all staking records for a specific user
     * @param user User address
     */
    function getUserStakes(address user) external view returns (Stk[] memory) {
        Stk[] memory userStakeRecords = new Stk[](userStakes[user].length);

        for (uint i = 0; i < userStakes[user].length; i++) {
            userStakeRecords[i] = stakes[userStakes[user][i]];
        }

        return userStakeRecords;
    }

    /**
     * @notice Manager can pause the contract
     */
    function pause() external onlyRole(MANAGER_ROLE) {
        _pause();
    }

    /**
     * @notice Manager can unpause the contract
     */
    function unpause() external onlyRole(MANAGER_ROLE) {
        _unpause();
    }
}
