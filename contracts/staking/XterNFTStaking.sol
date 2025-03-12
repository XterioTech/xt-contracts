// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract XterNFTStaking is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // Role definitions
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // Allowed NFT collections
    mapping(address => bool) public allowedCollections;

    // Mapping to track the staker for NFTs
    // mapping (collection => (token index => staker))
    mapping(address => mapping(uint256 => address)) public staker;

    // Mapping to track the staked NFT count by each user in each collection
    // mapping (staker => (collection => balance))
    mapping(address => mapping(address => uint256)) public stakingBalance;

    event StakeNFT(
        address indexed user,
        address indexed collection,
        uint256[] tokenIds,
        uint256 stakingBalance
    );

    event UnstakeNFT(
        address indexed user,
        address indexed collection,
        uint256[] tokenIds,
        uint256 remainingBalance
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) public initializer {
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADER_ROLE) {}

    modifier onlyAllowedCollection(address collection) {
        require(
            allowedCollections[collection],
            "This NFT collection is not allowed"
        );
        _;
    }

    // Function to pause/unpause the contract
    function setPaused(bool _paused) external onlyRole(MANAGER_ROLE) {
        if (_paused) {
            _pause();
        } else {
            _unpause();
        }
    }

    // Function to add or remove allowed NFT collections
    function setAllowedCollection(
        address collection,
        bool allowed
    ) external onlyRole(MANAGER_ROLE) {
        allowedCollections[collection] = allowed;
    }

    // Function to stake an NFT
    function stake(
        address collection,
        uint256[] calldata tokenIds
    ) external whenNotPaused nonReentrant onlyAllowedCollection(collection) {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            // transfer nft
            IERC721Upgradeable(collection).transferFrom(
                msg.sender,
                address(this),
                tokenIds[i]
            );
            // update staker
            staker[collection][tokenIds[i]] = msg.sender;
        }
        // update balance
        stakingBalance[msg.sender][collection] += tokenIds.length;
        //  emit log
        emit StakeNFT(msg.sender, collection, tokenIds, stakingBalance[msg.sender][collection]);
    }

    // Function to unstake an NFT
    function unstake(
        address collection,
        uint256[] calldata tokenIds
    ) external whenNotPaused nonReentrant {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(staker[collection][tokenIds[i]] == msg.sender, "Not the corresponding NFT staker");
            // update staker
            staker[collection][tokenIds[i]] = address(0);
            // transfer nft
            IERC721Upgradeable(collection).transferFrom(
                address(this),
                msg.sender,
                tokenIds[i]
            );
        }
        // update balance
        stakingBalance[msg.sender][collection] -= tokenIds.length;
        //  emit log
        emit UnstakeNFT(msg.sender, collection, tokenIds, stakingBalance[msg.sender][collection]);
    }

    // ERC721 Receiver function to handle incoming NFTs
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721ReceiverUpgradeable.onERC721Received.selector;
    }
}
