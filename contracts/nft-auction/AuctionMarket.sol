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
    address public paymentRecipient;
    uint256 public auctionEndTime;

    uint256 public MAX_BID_PER_USER = 50;

    mapping(address => BidHeap.Bid[]) public userBids;
    mapping(address => uint256) public userActiveBidsCnt;
    mapping(address => bool) public hasClaimed;

    uint256 public highestBidPrice;

    constructor(
        address _gateway,
        address _nftAddress,
        address _paymentRecipient,
        uint256 maxCapacity,
        uint256 _auctionEndTime
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MANAGER_ROLE, msg.sender);

        gateway = _gateway;
        nftAddress = _nftAddress;
        paymentRecipient = _paymentRecipient;
        auctionEndTime = _auctionEndTime;
        _heap.MAX_CAPACITY = maxCapacity;
    }

    receive() external payable {}

    /**************** Management Functions ****************/
    function sendPayment() external returns (bool success) {
        require(
            block.timestamp > auctionEndTime,
            "payment can only be made after the auction has ended"
        );
        uint256 value = _heap.tree.length * _heap.getMin().price;
        (success, ) = paymentRecipient.call{value: value}("");
        require(success, "AuctionMarket: failed to send payment");
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

    function setAuctionEndTime(uint256 _t) external onlyRole(MANAGER_ROLE) {
        auctionEndTime = _t;
    }

    function setMaxBidPerUser(uint256 _max) external onlyRole(MANAGER_ROLE) {
        MAX_BID_PER_USER = _max;
    }

    /**************** Core Functions ****************/
    function placeBid(uint256 price) external payable {
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
            block.timestamp > auctionEndTime,
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

    function topBid() external view returns (BidHeap.Bid memory) {
        return _heap.getMin();
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
