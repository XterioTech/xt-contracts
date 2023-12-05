// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "hardhat/console.sol";

abstract contract FansCreateCore is AccessControl, ERC1155Supply {
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    event SetFeeRatio(
        uint256 protocolFeeRatio,
        uint256 projectFeeRatio,
        uint256 creatorFeeRatio
    );
    event SetProtocolFeeRecipient(address recipient);
    event SetProjectFeeRecipient(uint256 projectId, address recipient);

    event Publish(address indexed creator, uint256 workId, uint256 projectId);

    event Trade(
        address indexed trader,
        address indexed creator,
        uint256 indexed workId,
        bool isBuy,
        uint256 keyAmount,
        uint256 price,
        uint256 keySupplyAfterTrade
    );

    event DistributeFee(
        address indexed trader,
        address indexed creator,
        uint256 indexed workId,
        uint256 creatorFeeAmount,
        address projectFeeRecipient,
        uint256 projectFeeAmount,
        address protocolFeeRecipient,
        uint256 protocolFeeAmount
    );

    struct PriceFeeInfo {
        uint256 price;
        uint256 priceAfterFee;
        uint256 creatorFee;
        uint256 projectFee;
        uint256 protocolFee;
        uint256 projectId;
    }

    // fee ratios
    uint256 public constant FEE_RATIO_DENOMINATOR = 10000;
    uint256 public protocolFeeRatio = 400;
    uint256 public projectFeeRatio = 400;
    uint256 public creatorFeeRatio = 400;

    // protocol fee recipient
    address public protocolFeeRecipient;
    // mapping from projectId to its fee recipient
    mapping(uint256 => address) public projectFeeRecipient;

    // only addresses in this whitelist can transfer tokens
    mapping(address => bool) public transferWhitelisted;

    // mapping from workId to projectId
    mapping(uint256 => uint256) public workProjectId;
    // mapping from workId to the creator
    mapping(uint256 => address) public workCreator;

    constructor(address admin, string memory uri) ERC1155(uri) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        protocolFeeRecipient = admin;
    }

    /**
     * Forbidden transfer, unless the from, to or operator is whitelisted
     *
     * @dev Hook that is called before any token transfer. This includes minting
     * and burning, as well as batched variants.
     */
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override {
        require(
            from == address(0) ||
                to == address(0) ||
                transferWhitelisted[from] ||
                transferWhitelisted[to] ||
                transferWhitelisted[operator],
            "FansCreateCore: transfer not allowed"
        );
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControl, ERC1155) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /****************** Payment Relative Functions (need to be override) ******************/

    /// @dev This virtual function should return the coefficient C of calculating the price
    ///     price(supply) = C * supply * supply
    /// note that this coefficient should take into account the payment token's decimals, as the calculated price is considered the raw value
    function priceCoefficient() internal view virtual returns (uint256);

    /// @dev This virtual function should check and charge trader the specified `amount` of the payment token
    function payIn(uint256 amount) internal virtual;

    /// @dev This virtual function should transfer the specified `amount` of the payment token to the `to` address
    function payOut(uint256 amount, address to) internal virtual;

    /****************** Trading Functions ******************/

    function calcPrice(
        uint256 supply,
        uint256 amount
    ) public view returns (uint256) {
        uint256 sum1 = supply == 0
            ? 0
            : ((supply - 1) * (supply) * (2 * (supply - 1) + 1)) / 6;
        uint256 sum2 = supply == 0 && amount == 1
            ? 0
            : ((supply + amount - 1) *
                (supply + amount) *
                (2 * (supply + amount - 1) + 1)) / 6;
        uint256 summation = sum2 - sum1;
        return summation * priceCoefficient();
    }

    function _getPriceInfo(
        uint256 workId,
        uint256 supply,
        uint256 amount,
        bool isBuy
    ) private view returns (PriceFeeInfo memory) {
        if (!isBuy) {
            supply = supply - amount;
        }
        uint256 price = calcPrice(supply, amount);
        uint256 protoFee = (price * protocolFeeRatio) / FEE_RATIO_DENOMINATOR;
        uint256 projectFee = (price * projectFeeRatio) / FEE_RATIO_DENOMINATOR;
        uint256 creatorFee = (price * creatorFeeRatio) / FEE_RATIO_DENOMINATOR;
        uint256 projectId = workProjectId[workId];
        if (projectId == 0) {
            protoFee = protoFee + projectFee;
            projectFee = 0;
        }
        if (isBuy) {
            return
                PriceFeeInfo(
                    price,
                    price + protoFee + projectFee + creatorFee,
                    creatorFee,
                    projectFee,
                    protoFee,
                    projectId
                );
        } else {
            return
                PriceFeeInfo(
                    price,
                    price - protoFee - projectFee - creatorFee,
                    creatorFee,
                    projectFee,
                    protoFee,
                    projectId
                );
        }
    }

    function getBuyPrice(
        uint256 workId,
        uint256 amount
    ) public view returns (PriceFeeInfo memory) {
        return _getPriceInfo(workId, totalSupply(workId), amount, true);
    }

    function getSellPrice(
        uint256 workId,
        uint256 amount
    ) public view returns (PriceFeeInfo memory) {
        return _getPriceInfo(workId, totalSupply(workId), amount, false);
    }

    // @note In order to support proxied transaction (e.g. fiat payment purchase), we pass in the `creator` field in stead of referring msg.sender as the creator
    function publishAndBuyKeys(
        address creator,
        uint256 workId,
        uint256 amount,
        uint256 projectId,
        uint256 deadline,
        address signer,
        bytes calldata signature
    ) external payable {
        require(
            hasRole(SIGNER_ROLE, signer),
            "FansCreateCore: not a valid signer"
        );
        require(
            block.timestamp <= deadline,
            "FansCreateCore: deadline exceeded"
        );
        require(workCreator[workId] == address(0), "FansCreateCore: already published");
        // Check signature validity
        bytes32 hash = keccak256(
            abi.encodePacked(
                creator,
                workId,
                projectId,
                deadline,
                block.chainid,
                address(this)
            )
        );
        require(
            signer ==
                ECDSA.recover(ECDSA.toEthSignedMessageHash(hash), signature),
            "FansCreateCore: invalid signature"
        );
        // Publish and record work info
        workCreator[workId] = creator;
        workProjectId[workId] = projectId;
        emit Publish(creator, workId, projectId);
        buyKeys(creator, workId, amount, type(uint256).max);
    }

    // @note In order to support proxied trading (e.g. fiat payment purchase), the purchased tokens are transfered to `trader` instead of msg.sender
    //      The trader can pass in his own address as `trader` in the common case.
    function buyKeys(
        address trader,
        uint256 workId,
        uint256 amount,
        uint256 maxPriceAfterFee
    ) public payable {
        address creator = workCreator[workId];
        require(
            creator != address(0),
            "FansCreateCore: work not published yet"
        );
        uint256 supply = totalSupply(workId);
        PriceFeeInfo memory priceInfo = _getPriceInfo(
            workId,
            supply,
            amount,
            true
        );
        require(
            priceInfo.priceAfterFee <= maxPriceAfterFee,
            "FansCreateCore: price limit exceeded"
        );
        // pay in price after fee
        payIn(priceInfo.priceAfterFee);
        // mint key tokens
        _mint(trader, workId, amount, "");
        emit Trade(
            trader,
            creator,
            workId,
            true,
            amount,
            priceInfo.price,
            supply + amount
        );
        // pay out fees
        payOut(priceInfo.creatorFee, creator);
        payOut(priceInfo.protocolFee, protocolFeeRecipient);
        address _projectFeeRecipient;
        if (priceInfo.projectFee > 0) {
            _projectFeeRecipient = projectFeeRecipient[priceInfo.projectId];
            payOut(priceInfo.projectFee, _projectFeeRecipient);
        }
        emit DistributeFee(
            trader,
            creator,
            workId,
            priceInfo.creatorFee,
            _projectFeeRecipient,
            priceInfo.projectFee,
            protocolFeeRecipient,
            priceInfo.protocolFee
        );
    }

    function sellKeys(
        uint256 workId,
        uint256 amount,
        uint256 minPriceAfterFee
    ) public payable {
        address creator = workCreator[workId];
        require(
            creator != address(0),
            "FansCreateCore: work not published yet"
        );
        uint256 supply = totalSupply(workId);
        PriceFeeInfo memory priceInfo = _getPriceInfo(
            workId,
            supply,
            amount,
            false
        );
        require(
            priceInfo.priceAfterFee >= minPriceAfterFee,
            "FansCreateCore: price limit exceeded"
        );
        // burn key tokens
        _burn(msg.sender, workId, amount);
        emit Trade(
            msg.sender,
            creator,
            workId,
            false,
            amount,
            priceInfo.price,
            supply - amount
        );
        // pay out price
        payOut(priceInfo.priceAfterFee, msg.sender);
        // pay out fees
        payOut(priceInfo.creatorFee, creator);
        payOut(priceInfo.protocolFee, protocolFeeRecipient);
        address _projectFeeRecipient;
        if (priceInfo.projectFee > 0) {
            _projectFeeRecipient = projectFeeRecipient[priceInfo.projectId];
            payOut(priceInfo.projectFee, _projectFeeRecipient);
        }
        emit DistributeFee(
            msg.sender,
            creator,
            workId,
            priceInfo.creatorFee,
            _projectFeeRecipient,
            priceInfo.projectFee,
            protocolFeeRecipient,
            priceInfo.protocolFee
        );
    }

    /****************** Admin Functions ******************/
    function setURI(string calldata uri) external onlyRole(MANAGER_ROLE) {
        _setURI(uri);
    }

    function setTransferWhitelisted(
        address addr,
        bool whitelisted
    ) external onlyRole(MANAGER_ROLE) {
        transferWhitelisted[addr] = whitelisted;
    }

    function setFeeRatio(
        uint256 _protocolFeeRatio,
        uint256 _projectFeeRatio,
        uint256 _creatorFeeRatio
    ) external onlyRole(MANAGER_ROLE) {
        protocolFeeRatio = _protocolFeeRatio;
        projectFeeRatio = _projectFeeRatio;
        creatorFeeRatio = _creatorFeeRatio;
        emit SetFeeRatio(_protocolFeeRatio, _projectFeeRatio, _creatorFeeRatio);
    }

    function setProtocolFeeRecipient(
        address _protocolFeeRecipient
    ) external onlyRole(MANAGER_ROLE) {
        protocolFeeRecipient = _protocolFeeRecipient;
        emit SetProtocolFeeRecipient(_protocolFeeRecipient);
    }

    function setProjectFeeRecipient(
        uint256 projectId,
        address _projectFeeRecipient
    ) external onlyRole(MANAGER_ROLE) {
        projectFeeRecipient[projectId] = _projectFeeRecipient;
        emit SetProjectFeeRecipient(projectId, _projectFeeRecipient);
    }

    function setWorkProjectId(
        uint256 workId,
        uint256 projectId
    ) external onlyRole(MANAGER_ROLE) {
        workProjectId[workId] = projectId;
    }
}
