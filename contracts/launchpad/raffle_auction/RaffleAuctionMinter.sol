// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./RaffleBidHeap.sol";
import "../../basic-tokens/interfaces/IGateway.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract RaffleAuctionMinter is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 public constant MAX_BID_PER_USER = 50;

    struct ClaimInfo {
        bool hasClaimed;
        uint256 refundAmount;
        uint256 nftCount;
    }

    event Bid(address indexed buyer, uint256 bidPrice);
    event Claim(address indexed buyer, uint256 refundAmount, uint256 nftCount);

    using RaffleBidHeap for RaffleBidHeap.Heap;
    RaffleBidHeap.Heap private _heap;

    uint256 private _idCounter;
    address public gateway;
    address public nftAddress;
    address public paymentRecipient;
    uint256 public auctionEndTime;

    mapping(address => RaffleBidHeap.Bid[]) public userBids;
    mapping(address => bool) public hasClaimed;
    // bidder => limitForBuyerID => bidAmount
    mapping(address => mapping(uint256 => uint256)) buyerBidCount;

    uint256 public highestBidPrice;
    bool public paymentSent;

    constructor(
        address _admin,
        address _gateway,
        address _nftAddress,
        address _paymentRecipient,
        uint256 _nftAmount,
        uint256 _auctionEndTime
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        _setupRole(MANAGER_ROLE, _admin);
        _setupRole(MANAGER_ROLE, msg.sender);

        gateway = _gateway;
        nftAddress = _nftAddress;
        paymentRecipient = _paymentRecipient;
        auctionEndTime = _auctionEndTime;
        _heap.initialize(_nftAmount);
    }

    receive() external payable {}

    /**************** Management Functions ****************/
    function sendPayment() external {
        require(
            block.timestamp > auctionEndTime,
            "RaffleAuctionMinter: payment can only be made after the auction has ended"
        );
        require(!paymentSent, "RaffleAuctionMinter: payment already sent");
        uint256 value = _heap.size() * _heap.minBid().price;
        (bool success, ) = paymentRecipient.call{value: value}("");
        require(success, "RaffleAuctionMinter: failed to send payment");
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

    function setAuctionEndTime(uint256 _t) external onlyRole(MANAGER_ROLE) {
        require(_t > block.timestamp, "RaffleAuctionMinter: invalid timestamp");
        require(block.timestamp <= auctionEndTime, "RaffleAuctionMinter: already ended");
        auctionEndTime = _t;
    }

    /**************** Core Functions ****************/
    function placeBid(
        uint256 bidPrice,
        uint256 limitForBuyerID,
        uint256 limitForBuyerAmount,
        uint256 expireTime,
        bytes calldata _sig
    ) external payable {
        // Check signature validity
        bytes32 inputHash = _getInputHash(
            bidPrice,
            limitForBuyerID,
            limitForBuyerAmount,
            expireTime
        );
        address signer = IGateway(gateway).nftManager(nftAddress);
        _checkSigValidity(inputHash, _sig, signer);

        require(
            block.timestamp <= expireTime,
            "RaffleAuctionMinter: signature expired"
        );
        require(
            block.timestamp <= auctionEndTime,
            "RaffleAuctionMinter: auction ended"
        );

        require(
            userBids[msg.sender].length < MAX_BID_PER_USER,
            "RaffleAuctionMinter: maximum bid per user reached"
        );
        require(
            buyerBidCount[msg.sender][limitForBuyerID] < limitForBuyerAmount,
            "RaffleAuctionMinter: buyer limit exceeded"
        );

        require(msg.value == bidPrice, "RaffleAuctionMinter: payment mismatch");

        buyerBidCount[msg.sender][limitForBuyerID] += 1;

        _idCounter += 1;
        RaffleBidHeap.Bid memory newBid = RaffleBidHeap.Bid(
           uint32(_idCounter),
            msg.sender,
            uint32(block.timestamp),
            generateRandomNumber(_idCounter),
            bidPrice
        );

        userBids[msg.sender].push(newBid);
        _heap.tryInsert(newBid);

        emit Bid(msg.sender, bidPrice);
    }

    function claimInfo(address _a) public view returns (ClaimInfo memory info) {
        require(
            block.timestamp > auctionEndTime,
            "AuctionMinter: No claimInfo allowed until auction ends"
        );
        info.hasClaimed = hasClaimed[_a];
        info.refundAmount = 0;
        info.nftCount = 0;
        RaffleBidHeap.Bid memory _floorBid = _heap.minBid();
        for (uint256 i = 0; i < userBids[_a].length; i++) {
            if (RaffleBidHeap.isHigherOrEqualBid(userBids[_a][i], _floorBid)) {
                info.nftCount += 1;
                info.refundAmount += userBids[_a][i].price - _floorBid.price;
            } else {
                info.refundAmount += userBids[_a][i].price;
            }
        }
    }

    function claimAndRefund() external {
        require(
            block.timestamp > auctionEndTime,
            "RaffleAuctionMinter: No claims or refunds allowed until auction ends"
        );
        ClaimInfo memory info = claimInfo(msg.sender);

        require(!info.hasClaimed, "RaffleAuctionMinter: has claimed");
        require(
            info.nftCount > 0 || info.refundAmount > 0,
            "RaffleAuctionMinter: nothing to claim"
        );

        hasClaimed[msg.sender] = true;

        for (uint256 i = 0; i < info.nftCount; i++) {
            IGateway(gateway).ERC721_mint(nftAddress, msg.sender, 0);
        }
        (bool success, ) = msg.sender.call{value: info.refundAmount}("");
        require(success, "RaffleAuctionMinter: failed to send refund");

        emit Claim(msg.sender, info.refundAmount, info.nftCount);
    }

    /**************** View Functions ****************/
    function tvl() external view returns (uint256) {
        return address(this).balance;
    }

    function floorBid() external view returns (RaffleBidHeap.Bid memory) {
        return _heap.minBid();
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
    ) external view returns (RaffleBidHeap.Bid[][] memory bids) {
        bids = new RaffleBidHeap.Bid[][](_addresses.length);
        for (uint256 i = 0; i < _addresses.length; i++) {
            bids[i] = userBids[_addresses[i]];
        }
    }

    function getTotalBidsCnt() external view returns (uint256) {
        return _idCounter;
    }

    function getBidAmtByBuyerId(
        address _buyer,
        uint256 _limitForBuyerID
    ) external view returns (uint256) {
        return buyerBidCount[_buyer][_limitForBuyerID];
    }

    function _getInputHash(
        uint256 bidPrice,
        uint256 limitForBuyerID,
        uint256 limitForBuyerAmount,
        uint256 expireTime
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    bidPrice,
                    limitForBuyerID,
                    limitForBuyerAmount,
                    expireTime,
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
            "RaffleAuctionMinter: invalid signature"
        );
    }

    function _getEthSignedMessageHash(
        bytes32 criteriaMessageHash
    ) internal pure returns (bytes32) {
        return ECDSA.toEthSignedMessageHash(criteriaMessageHash);
    }

    function generateRandomNumber(uint256 userInput) public view returns (uint32) {
        uint256 randomNumber = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1), // Use the hash value of the previous block as a seed
                    block.timestamp, // Use the current block's timestamp as a seed
                    userInput // Use the user input as a seed
                )
            )
        );
        return uint32(randomNumber);
    }

}
