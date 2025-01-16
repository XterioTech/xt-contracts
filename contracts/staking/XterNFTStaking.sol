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

    // Mapping to track the token IDs staked by each user in each collection
    mapping(address => mapping(address => uint256[]))
        public userCollectionTokenIds;

    // Mapping to track the total number of NFTs staked by each user across all collections
    mapping(address => uint256) public userTotalStakedCount;

    event Staked(
        address indexed user,
        address indexed collection,
        uint256 indexed tokenId,
        uint256 timestamp
    );

    event Unstaked(
        address indexed user,
        address indexed collection,
        uint256 indexed tokenId,
        uint256 timestamp
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
        uint256 tokenId
    ) external whenNotPaused nonReentrant onlyAllowedCollection(collection) {
        IERC721Upgradeable(collection).transferFrom(
            msg.sender,
            address(this),
            tokenId
        );

        userCollectionTokenIds[msg.sender][collection].push(tokenId);

        // Update the user's total staked count
        userTotalStakedCount[msg.sender]++;

        emit Staked(msg.sender, collection, tokenId, block.timestamp);
    }

    // Function to unstake an NFT
    function unstake(
        address collection,
        uint256 tokenId
    ) external whenNotPaused nonReentrant {
        require(
            userCollectionTokenIds[msg.sender][collection].length > 0,
            "No tokens staked in this collection"
        );

        // Find and remove the token ID from the user's staked tokens for the specific collection
        uint256[] storage tokenIds = userCollectionTokenIds[msg.sender][
            collection
        ];

        bool found = false;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (tokenIds[i] == tokenId) {
                // Remove the token ID from the array by swapping with the last element and popping it off
                tokenIds[i] = tokenIds[tokenIds.length - 1];
                tokenIds.pop();
                found = true;
                break;
            }
        }

        require(found, "Token ID not found in staked tokens");

        IERC721Upgradeable(collection).transferFrom(
            address(this),
            msg.sender,
            tokenId
        );

        // Update the user's total staked count
        userTotalStakedCount[msg.sender]--;

        emit Unstaked(msg.sender, collection, tokenId, block.timestamp);
    }

    // Function to get the total staked NFTs for a specific user in a specific collection
    function getUserCollectionTokenIds(
        address user,
        address collection
    ) external view returns (uint256[] memory) {
        return userCollectionTokenIds[user][collection];
    }

    // Function to get the total number of NFTs staked by a specific user across all collections
    function getUserTotalStakedCount(
        address user
    ) external view returns (uint256) {
        return userTotalStakedCount[user];
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
