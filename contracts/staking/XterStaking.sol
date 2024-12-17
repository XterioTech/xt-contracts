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

    // Staking status
    struct Stk {
        uint256 id; // Unique identifier for each stake
        address staker; // Address of the staker
        uint256 amount; // Amount staked
        uint256 startTime; // Staking start time
        uint256 duration; // Duration in seconds
        bool claimed; // default is false
    }

    // Store user stakes
    Stk[] public stakes;

    mapping(address => uint256[]) public userStakes; // Mapping from user address to their stake record IDs

    event Stake(
        address indexed user,
        uint256 indexed id,
        uint256 amount,
        uint256 startTime,
        uint256 duration,
        bool claimed
    );

    event UnStake(
        address indexed user,
        uint256 indexed id,
        uint256 amount,
        uint256 startTime,
        uint256 duration,
        bool claimed
    );

    event ReStake(
        address indexed user,
        uint256 indexed id,
        uint256 amount,
        uint256 startTime,
        uint256 duration,
        bool claimed
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

    /// @dev ────────────────────────────────────────────────
    /// @dev                     Core Functions
    /// @dev ────────────────────────────────────────────────
    /**
     * @notice User to stake
     * @param amount Amount to stake
     * @param duration Duration in seconds
     */
    function stake(
        uint256 amount,
        uint256 duration, // Duration in seconds
        address _beneficiary
    ) public whenNotPaused nonReentrant {
        require(amount > 0, "Stake amount must be greater than zero");

        XTER.safeTransferFrom(msg.sender, address(this), amount);

        address staker = _beneficiary != address(0) ? _beneficiary : msg.sender; // Determine staker

        stakes.push(
            Stk({
                id: stakes.length,
                staker: staker,
                amount: amount,
                startTime: block.timestamp,
                duration: duration,
                claimed: false
            })
        );

        userStakes[staker].push(stakes.length - 1); // Save staker's stake record ID

        emit Stake(
            staker,
            stakes.length - 1,
            amount,
            block.timestamp,
            duration,
            false
        );
    }

    modifier canUnstake(uint256 _id) {
        Stk storage stakeData = stakes[_id];
        require(stakeData.staker == msg.sender, "Not authorized");
        require(
            block.timestamp >= stakeData.startTime + stakeData.duration,
            "Stake period not ended"
        );
        require(!stakeData.claimed, "Stake not valid or already claimed");
        stakeData.claimed = true; // Set as claimed
        _;
    }

    /**
     * @notice User to unstake
     * @param _id Stake record ID
     */
    function unstake(
        uint256 _id
    ) external whenNotPaused nonReentrant canUnstake(_id) {
        Stk storage stakeData = stakes[_id];

        XTER.safeTransfer(msg.sender, stakeData.amount);

        emit UnStake(
            msg.sender,
            _id,
            stakeData.amount,
            stakeData.startTime,
            stakeData.duration,
            stakeData.claimed
        );
    }

    /**
     * @notice User can claim part of their stake and restake
     * @param _id Stake record ID
     * @param duration Duration in seconds
     */
    function restake(
        uint256 _id,
        uint256 duration // Duration in seconds
    ) external whenNotPaused nonReentrant canUnstake(_id) {
        Stk storage stakeData = stakes[_id];

        // restake previous amount
        stake(stakeData.amount, duration, address(0));

        emit ReStake(
            msg.sender,
            _id,
            stakeData.amount,
            block.timestamp,
            duration, // new duration
            false
        );
    }

    /// @dev ────────────────────────────────────────────────
    /// @dev                     View Functions
    /// @dev ────────────────────────────────────────────────
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

    /// @dev ────────────────────────────────────────────────
    /// @dev                     Management Functions
    /// @dev ────────────────────────────────────────────────

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
