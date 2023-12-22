// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BidHeap.sol";
import "../basic-tokens/interfaces/IGateway.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract AuctionMarket is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct Eligibility {
        bool hasClaimed;
        uint256 refundAmt;
        uint256 winCnt;
    }

    using SafeMath for uint256;
    using Counters for Counters.Counter;
    using BidHeap for BidHeap.Heap;

    BidHeap.Heap private _heap;
    Counters.Counter private _idCounter;

    address public gateway;
    address public nftAddress;
    uint256 public auctionStartTime;

    uint256 public AUCTION_DURATION = 72 hours;
    uint256 public MAX_BID_PER_USER = 50;

    uint256 public MIN_PRICE = 0.25 ether;
    uint256 public MAX_PRICE = 0.75 ether;

    mapping(address => BidHeap.Bid[]) public userBids;
    mapping(address => uint256) public userActiveBidsCnt;
    mapping(address => bool) public hasClaimed;

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
        auctionStartTime = _auctionStartTime;
        _heap.MAX_CAPACITY = maxCapacity;
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

    function setMaxBidPerUser(uint256 _max) external onlyRole(MANAGER_ROLE) {
        MAX_BID_PER_USER = _max;
    }

    function setAuctionStartTime(uint256 _t) external onlyRole(MANAGER_ROLE) {
        auctionStartTime = _t;
    }

    function setAuctionDuration(uint256 _t) external onlyRole(MANAGER_ROLE) {
        AUCTION_DURATION = _t;
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
            userBids[msg.sender].length < MAX_BID_PER_USER,
            "Maximum bid per user reached"
        );

        require(msg.value >= price, "AuctionMarket: insufficient payment");
        (bool sent, ) = address(this).call{value: msg.value}("");
        require(sent, "AuctionMarket: failed to receive bid price");

        _idCounter.increment();
        BidHeap.Bid memory newBid = BidHeap.Bid(
            _idCounter.current(),
            msg.sender,
            price,
            block.timestamp
        );

        if (_heap.canInsert(newBid)) {
            if (_heap.isFull()) {
                address _loser = _heap.getMin().bidder;
                userActiveBidsCnt[_loser] -= 1;
            }
            _heap.insert(newBid);
            userActiveBidsCnt[msg.sender] += 1;
            if (price > highestBidPrice) {
                highestBidPrice = price;
            }
        }
        userBids[msg.sender].push(newBid);
    }

    function isEligible(
        address _a
    )
        public
        view
        returns (bool hasclaimed, uint256 _refundAmt, uint256 _winCnt)
    {
        hasclaimed = hasClaimed[_a];
        _refundAmt = 0;
        for (uint256 i = 0; i < userBids[_a].length; i++) {
            if (_heap.isInHeap(userBids[_a][i])) {
                _refundAmt += userBids[_a][i].price - _heap.getMin().price;
            } else {
                _refundAmt += userBids[_a][i].price;
            }
        }
        _winCnt = userActiveBidsCnt[_a];
    }

    function claimAndRefund() external {
        require(
            block.timestamp >= auctionStartTime.add(AUCTION_DURATION),
            "No claims or refunds allowed until auction ends"
        );
        (bool _hasclaimed, uint256 _refundAmt, uint256 _winCnt) = isEligible(
            _msgSender()
        );

        require(
            !_hasclaimed && (_winCnt > 0 || _refundAmt > 0),
            "has claimed || No Win Auction NFT || No refund available"
        );

        for (uint256 i = 0; i < _winCnt; i++) {
            IGateway(gateway).ERC721_mint(nftAddress, msg.sender, 0);
        }
        (bool success, ) = msg.sender.call{value: _refundAmt}("");
        require(success, "AuctionMarket: failed to send refund");

        hasClaimed[msg.sender] = true;
    }

    /**************** View Functions ****************/
    function tvl() external view returns (uint256) {
        return address(this).balance;
    }

    function getStartAndEndTimes() external view returns (uint256, uint256) {
        return (auctionStartTime, auctionStartTime.add(AUCTION_DURATION));
    }

    function getUserEligible(
        address[] calldata _addresses
    ) external view returns (Eligibility[] memory results) {
        results = new Eligibility[](_addresses.length);
        for (uint256 i = 0; i < _addresses.length; i++) {
            (
                results[i].hasClaimed,
                results[i].refundAmt,
                results[i].winCnt
            ) = isEligible(_addresses[i]);
        }
    }

    function getUserBids(
        address[] calldata _addresses
    ) external view returns (BidHeap.Bid[][] memory) {
        return _createBidsArray(_addresses, userBids);
    }

    function _createBidsArray(
        address[] calldata _addresses,
        mapping(address => BidHeap.Bid[]) storage _bidsMapping
    ) internal view returns (BidHeap.Bid[][] memory) {
        BidHeap.Bid[][] memory bids = new BidHeap.Bid[][](_addresses.length);
        for (uint256 i = 0; i < _addresses.length; i++) {
            bids[i] = _bidsMapping[_addresses[i]];
        }
        return bids;
    }

    function getTotalBidsCnt() external view returns (uint256) {
        return _idCounter.current();
    }

    function getUserActiveBidsCnt(
        address[] calldata _addresses
    ) external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < _addresses.length; i++) {
            total += userActiveBidsCnt[_addresses[i]];
        }
        return total;
    }
}
