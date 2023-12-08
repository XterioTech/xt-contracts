// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MinHeapAuction.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract AuctionMarket is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    using SafeMath for uint256;

    address public nftAddress;
    MinHeapAuction private minHeapAuction;
    uint256 public auctionStartTime;

    uint256 public constant AUCTION_DURATION = 72 hours;
    uint256 public constant MAX_BID_PER_USER = 5;

    uint256 public constant MIN_PRICE = 0.25 ether;
    uint256 public constant MAX_PRICE = 0.75 ether;

    mapping(address => AuctionInfo[]) public userAuctions;
    mapping(address => uint256) public userRefunds;

    uint256 public totalBidsCnt;
    uint256 public highestBidPrice;

    constructor(
        address _nftAddress,
        uint256 maxCapacity,
        uint256 _auctionStartTime
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MANAGER_ROLE, msg.sender);

        nftAddress = _nftAddress;
        minHeapAuction = new MinHeapAuction(maxCapacity);
        auctionStartTime = _auctionStartTime;
    }

    receive() external payable {}

    /************************************ Management Functions *************************************/
    function withdrawTo(
        address _to
    ) public onlyRole(DEFAULT_ADMIN_ROLE) returns (bool sent) {
        (sent, ) = _to.call{value: address(this).balance}("");
    }

    /************************************ Core Functions *************************************/
    function placeBid(uint256 price) external payable {
        require(
            block.timestamp > auctionStartTime,
            "Auction has not started yet"
        );
        require(
            block.timestamp < auctionStartTime.add(AUCTION_DURATION),
            "Auction has ended"
        );
        require(price >= MIN_PRICE && price <= MAX_PRICE, "Invalid bid price");
        require(
            userAuctions[msg.sender].length <= MAX_BID_PER_USER,
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
            AuctionInfo memory currentMin = minHeapAuction.getMin();
            userRefunds[currentMin.bidder] += currentMin.price;
        }
        minHeapAuction.insert(newAuction);
        userAuctions[msg.sender].push(newAuction);
        totalBidsCnt += 1;
        if (price > highestBidPrice) {
            highestBidPrice = price;
        }
    }

    function claimRefund() external {
        uint256 refundAmount = userRefunds[msg.sender];
        require(refundAmount > 0, "No refund available");

        require(
            block.timestamp >= auctionStartTime.add(AUCTION_DURATION),
            "Refund only available after the auction ends"
        );

        userRefunds[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: refundAmount}("");
        require(success, "AuctionMarket: failed to send refund");
    }

    /************************************ Helper Functions *************************************/
    function tvl() external view returns (uint256) {
        return address(this).balance;
    }
}
