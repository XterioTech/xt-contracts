// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../basic-tokens/interfaces/IGateway.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract DepositMinter is AccessControl, ReentrancyGuardUpgradeable {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    struct Bid {
        uint256 id;
        address bidder;
        uint256 price;
        uint256 timestamp;
    }

    struct ClaimInfo {
        bool hasClaimed;
        uint256 refundAmount;
        uint256 nftCount;
    }

    event Claim(address indexed buyer, uint256 refundAmount, uint256 nftCount);

    using SafeMath for uint256;
    using Counters for Counters.Counter;

    Counters.Counter private _idCounter;

    address public gateway;
    address public nftAddress;
    address public paymentRecipient;
    uint256 public auctionStartTime;
    uint256 public auctionEndTime;
    uint256 public unitPrice;
    bool public paymentSent;

    uint256 public nftAmount; //set after wl round
    uint256 public limitForBuyerAmount = 1;

    mapping(address => bool) public hasClaimed;
    mapping(address => uint256) buyerBidCount; // bidder => bidAmount
    mapping(address => Bid[]) public userBids;

    constructor(
        address _admin,
        address _gateway,
        address _nftAddress,
        address _paymentRecipient,
        uint256 _auctionStartTime,
        uint256 _auctionEndTime,
        uint256 _unitPrice
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        _setupRole(MANAGER_ROLE, _admin);
        _setupRole(MANAGER_ROLE, msg.sender);

        gateway = _gateway;
        nftAddress = _nftAddress;
        paymentRecipient = _paymentRecipient;
        auctionStartTime = _auctionStartTime;
        auctionEndTime = _auctionEndTime;
        unitPrice = _unitPrice;
    }

    receive() external payable {}

    /**************** Management Functions ****************/
    function sendPayment() external nonReentrant {
        require(
            block.timestamp > auctionEndTime && nftAmount > 0,
            "DepositMinter: payment can only be made after the auction has ended & nftAmount has been set"
        );
        require(!paymentSent, "DepositMinter: payment already sent");

        uint256 value = unitPrice * nftAmount;
        (bool success, ) = paymentRecipient.call{value: value}("");
        require(success, "DepositMinter: failed to send payment");
        paymentSent = true;
    }

    function setGateway(address _g) external onlyRole(DEFAULT_ADMIN_ROLE) {
        gateway = _g;
    }

    function setRecipient(address _r) external onlyRole(DEFAULT_ADMIN_ROLE) {
        paymentRecipient = _r;
    }

    function setNftAddress(address _addr) external onlyRole(MANAGER_ROLE) {
        nftAddress = _addr;
    }

    function setNftAmount(uint256 _amt) external onlyRole(MANAGER_ROLE) {
        require(
            nftAmount == 0 || block.timestamp < auctionEndTime,
            "DepositMinter: nftAmount can not be changed after the auction ended"
        );
        nftAmount = _amt;
    }

    function setLimitForBuyerAmount(
        uint256 _amt
    ) external onlyRole(MANAGER_ROLE) {
        require(
            block.timestamp < auctionEndTime,
            "DepositMinter: limitForBuyerAmount can only be set before the auction end"
        );
        limitForBuyerAmount = _amt;
    }

    function setAuctionEndTime(uint256 _t) external onlyRole(MANAGER_ROLE) {
        require(_t > block.timestamp, "DepositMinter: invalid timestamp");
        auctionEndTime = _t;
    }

    function setAuctionStartTime(uint256 _t) external onlyRole(MANAGER_ROLE) {
        auctionStartTime = _t;
    }

    /**************** Core Functions ****************/
    function deposit() external payable nonReentrant {
        require(
            block.timestamp >= auctionStartTime &&
                block.timestamp <= auctionEndTime,
            "DepositMinter: deposit time invalid"
        );
        require(
            buyerBidCount[msg.sender] < limitForBuyerAmount,
            "DepositMinter: buyer limit exceeded"
        );

        require(msg.value == unitPrice, "DepositMinter: payment mismatch");

        buyerBidCount[msg.sender] += 1;

        _idCounter.increment();
        Bid memory newBid = Bid(
            _idCounter.current(),
            msg.sender,
            unitPrice,
            block.timestamp
        );

        userBids[msg.sender].push(newBid);
    }

    function claimInfo(address _a) public view returns (ClaimInfo memory info) {
        info.hasClaimed = hasClaimed[_a];
        info.refundAmount = 0;
        info.nftCount = 0;

        for (uint256 i = 0; i < userBids[_a].length; i++) {
            if (userBids[_a][i].id <= nftAmount) {
                info.nftCount += 1;
            } else {
                info.refundAmount += userBids[_a][i].price;
            }
        }
    }

    function claimAndRefund() external nonReentrant {
        require(
            block.timestamp > auctionEndTime && nftAmount > 0,
            "DepositMinter: No claims or refunds allowed until auction ends & nftAmount has been set"
        );
        ClaimInfo memory info = claimInfo(msg.sender);

        require(!info.hasClaimed, "DepositMinter: has claimed");
        require(
            info.nftCount > 0 || info.refundAmount > 0,
            "DepositMinter: nothing to claim"
        );

        hasClaimed[msg.sender] = true;

        for (uint256 i = 0; i < info.nftCount; i++) {
            IGateway(gateway).ERC721_mint(nftAddress, msg.sender, 0);
        }
        if (info.refundAmount > 0) {
            (bool success, ) = msg.sender.call{value: info.refundAmount}("");
            require(success, "DepositMinter: failed to send refund");
        }
        emit Claim(msg.sender, info.refundAmount, info.nftCount);
    }

    /**************** View Functions ****************/
    function tvl() external view returns (uint256) {
        return address(this).balance;
    }

    function getUserClaimInfos(
        address[] calldata _addresses
    ) external view returns (ClaimInfo[] memory results) {
        results = new ClaimInfo[](_addresses.length);
        for (uint256 i = 0; i < _addresses.length; i++) {
            results[i] = claimInfo(_addresses[i]);
        }
    }

    function getUserBids(
        address[] calldata _addresses
    ) external view returns (Bid[][] memory bids) {
        bids = new Bid[][](_addresses.length);
        for (uint256 i = 0; i < _addresses.length; i++) {
            bids[i] = userBids[_addresses[i]];
        }
    }

    function getTotalBidsCnt() external view returns (uint256) {
        return _idCounter.current();
    }

    function getBidAmtByBuyerId(
        address _buyer
    ) external view returns (uint256) {
        return buyerBidCount[_buyer];
    }
}
