// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BidHeap.sol";
import "../basic-tokens/interfaces/IGateway.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract AuctionMarket is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct ClaimInfo {
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
    mapping(address => bool) public hasClaimed;
    // bidder => limitForBuyerID => bidAmount
    mapping(address => mapping(uint256 => uint256)) bidBuyerId;

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
    function placeBid(
        uint256 bid_price,
        uint256 limit_for_buyer_id,
        uint256 limit_for_buyer_amount,
        uint256 expire_time,
        bytes calldata _sig
    ) external payable {
        // Check signature validity
        bytes32 inputHash = _getInputHash(
            bid_price,
            limit_for_buyer_id,
            limit_for_buyer_amount,
            expire_time
        );
        address signer = IGateway(gateway).nftManager(nftAddress);
        _checkSigValidity(inputHash, _sig, signer);

        require(block.timestamp <= expire_time, "AuctionMarket: too late");

        require(
            userBids[msg.sender].length < MAX_BID_PER_USER,
            "AuctionMarket: Maximum bid per user reached"
        );
        require(
            bidBuyerId[msg.sender][limit_for_buyer_id] < limit_for_buyer_amount,
            "AuctionMarket: buyer limit exceeded"
        );

        require(msg.value >= bid_price, "AuctionMarket: insufficient payment");

        (bool sent, ) = address(this).call{value: msg.value}("");
        require(sent, "AuctionMarket: failed to receive bid price");

        _idCounter.increment();
        BidHeap.Bid memory newBid = BidHeap.Bid(
            _idCounter.current(),
            msg.sender,
            bid_price,
            block.timestamp
        );

        if (_heap.canInsert(newBid)) {
            _heap.insert(newBid);
            highestBidPrice = bid_price > highestBidPrice
                ? bid_price
                : highestBidPrice;
        }
        userBids[msg.sender].push(newBid);
        bidBuyerId[msg.sender][limit_for_buyer_id] += 1;
    }

    function claimInfo(
        address _a
    )
        public
        view
        returns (bool hasclaimed, uint256 _refundAmt, uint256 _winCnt)
    {
        hasclaimed = hasClaimed[_a];
        _refundAmt = 0;
        _winCnt = 0;
        for (uint256 i = 0; i < userBids[_a].length; i++) {
            if (_heap.isInHeap(userBids[_a][i])) {
                _winCnt += 1;
                _refundAmt += userBids[_a][i].price - _heap.getMin().price;
            } else {
                _refundAmt += userBids[_a][i].price;
            }
        }
    }

    function claimAndRefund() external {
        require(
            block.timestamp > auctionEndTime,
            "No claims or refunds allowed until auction ends"
        );
        (bool _hasclaimed, uint256 _refundAmt, uint256 _winCnt) = claimInfo(
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

    function getUserClaimInfos(
        address[] calldata _addresses
    ) external view returns (ClaimInfo[] memory results) {
        results = new ClaimInfo[](_addresses.length);
        for (uint256 i = 0; i < _addresses.length; i++) {
            (
                results[i].hasClaimed,
                results[i].refundAmt,
                results[i].winCnt
            ) = claimInfo(_addresses[i]);
        }
    }

    function getUserBids(
        address[] calldata _addresses
    ) external view returns (BidHeap.Bid[][] memory bids) {
        bids = new BidHeap.Bid[][](_addresses.length);
        for (uint256 i = 0; i < _addresses.length; i++) {
            bids[i] = userBids[_addresses[i]];
        }
    }

    function getTotalBidsCnt() external view returns (uint256) {
        return _idCounter.current();
    }

    function _getInputHash(
        uint256 bid_price,
        uint256 limit_for_buyer_id,
        uint256 limit_for_buyer_amount,
        uint256 expire_time
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    bid_price,
                    limit_for_buyer_id,
                    limit_for_buyer_amount,
                    expire_time,
                    block.chainid,
                    address(this)
                )
            );
    }

    function _checkSigValidity(
        bytes32 hash,
        bytes memory sig,
        address signer
    ) internal pure {
        require(
            signer == ECDSA.recover(_getEthSignedMessageHash(hash), sig),
            "AuctionMarket: invalid signature"
        );
    }

    function _getEthSignedMessageHash(
        bytes32 criteriaMessageHash
    ) internal pure returns (bytes32) {
        return ECDSA.toEthSignedMessageHash(criteriaMessageHash);
    }
}
