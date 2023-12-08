// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MinHeapAuction.sol";
import "../basic-tokens/interfaces/IGateway.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AuctionMarket is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    using SafeMath for uint256;

    address public gateway;
    address public nftAddress;
    MinHeapAuction private minHeapAuction;
    uint256 public auctionStartTime;

    uint256 public constant AUCTION_DURATION = 72 hours;
    uint256 public constant MAX_BID_PER_USER = 50;

    uint256 public MIN_PRICE = 0.25 ether;
    uint256 public MAX_PRICE = 0.75 ether;

    mapping(address => AuctionInfo[]) public userAuctions;
    mapping(address => AuctionInfo[]) public userInvalidAuctions;
    mapping(address => uint256) public userActiveBidsCnt;
    mapping(address => uint256) public userRefunds;

    uint256 public totalBidsCnt;
    uint256 public highestBidPrice;

    constructor(
        address _gateway,
        address _nftAddress,
        uint256 maxCapacity,
        uint256 _auctionStartTime
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MANAGER_ROLE, msg.sender);

        gateway = _gateway;
        nftAddress = _nftAddress;
        minHeapAuction = new MinHeapAuction(maxCapacity);
        auctionStartTime = _auctionStartTime;
    }

    receive() external payable {}

    /**************** Management Functions ****************/
    function withdrawTo(
        address _to
    ) public onlyRole(DEFAULT_ADMIN_ROLE) returns (bool sent) {
        (sent, ) = _to.call{value: address(this).balance}("");
    }

    function setGateway(address _newGateway) external onlyRole(MANAGER_ROLE) {
        gateway = _newGateway;
    }

    function setNftAddress(address _addr) external onlyRole(MANAGER_ROLE) {
        nftAddress = _addr;
    }

    function setAuctionStartTime(uint256 _t) external onlyRole(MANAGER_ROLE) {
        auctionStartTime = _t;
    }

    function setMinPrice(uint256 _p) external onlyRole(MANAGER_ROLE) {
        MIN_PRICE = _p;
    }

    function setMaxPrice(uint256 _p) external onlyRole(MANAGER_ROLE) {
        MAX_PRICE = _p;
    }

    /**************** Core Functions ****************/
    function placeBid(uint256 price) external payable {
        require(
            block.timestamp >= auctionStartTime,
            "Auction has not started yet"
        );
        require(
            block.timestamp < auctionStartTime.add(AUCTION_DURATION),
            "Auction has ended"
        );
        require(price >= MIN_PRICE && price <= MAX_PRICE, "Invalid bid price");
        require(
            userAuctions[msg.sender].length < MAX_BID_PER_USER,
            "Maximum bid per user reached"
        );
        require(
            minHeapAuction.canInsert(price),
            "Bid price must be higher than current minimum bid"
        );

        require(msg.value >= price, "AuctionMarket: insufficient payment");
        (bool sent, ) = address(this).call{value: msg.value}("");
        require(sent, "AuctionMarket: failed to receive bid price");

        AuctionInfo memory newAuction = AuctionInfo(
            msg.sender,
            price,
            block.timestamp
        );
        if (minHeapAuction.isFull()) {
            AuctionInfo memory min = minHeapAuction.getMin();
            address _loser = min.bidder;
            userRefunds[_loser] += min.price;
            userInvalidAuctions[_loser].push(min);
            userActiveBidsCnt[_loser] -= 1;
        }
        minHeapAuction.insert(newAuction);
        userAuctions[msg.sender].push(newAuction);
        userActiveBidsCnt[msg.sender] += 1;
        totalBidsCnt += 1;
        if (price > highestBidPrice) {
            highestBidPrice = price;
        }
    }

    function claim() external {
        require(
            block.timestamp >= auctionStartTime.add(AUCTION_DURATION),
            "Refund only available after the auction ends"
        );
        uint256 _winCnt = userActiveBidsCnt[msg.sender];
        require(_winCnt > 0, "No Win Auction NFT");
        userActiveBidsCnt[msg.sender] = 0;

        for (uint256 i = 0; i < _winCnt; i++) {
            IGateway(gateway).ERC721_mint(nftAddress, msg.sender, 0);
        }
    }

    function claimRefund() external {
        require(
            block.timestamp >= auctionStartTime.add(AUCTION_DURATION),
            "Refunds cannot be made until the auction ends"
        );
        uint256 _refundAmt = userRefunds[msg.sender];
        require(_refundAmt > 0, "No refund available");
        userRefunds[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: _refundAmt}("");
        require(success, "AuctionMarket: failed to send refund");
    }

    /**************** View Functions ****************/
    function tvl() external view returns (uint256) {
        return address(this).balance;
    }
}
