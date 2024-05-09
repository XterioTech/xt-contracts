// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../basic-tokens/interfaces/IGateway.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract DepositRaffleMinter is AccessControl, ReentrancyGuardUpgradeable {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    struct Bid {
        uint32 id;
        address bidder;
        uint32 timestamp;
        uint32 share;
        uint256 price;
    }

    struct ClaimInfo {
        bool hasClaimed;
        uint256 refundAmount;
        uint256 nftCount;
    }

    event Deposit(address indexed buyer, uint256 unitPrice, uint256 share);
    event Claim(address indexed buyer, uint256 refundAmount, uint256 nftCount);

    uint256 private _idCounter;
    address public gateway;
    address public nftAddress;
    address public paymentRecipient;
    uint256 public auctionStartTime;
    uint256 public auctionEndTime;
    uint256 public unitPrice;
    uint256 public nftPrice;
    bool public paymentSent;

    uint256 public nftAmount;
    uint256 public limitForBuyerAmount = 1;
    uint256 public maxShare;

    mapping(address => bool) public hasClaimed;
    mapping(address => uint256) buyerBidCount; // bidder => bidAmount
    mapping(address => Bid[]) public userBids;

    Bid[] public bids;
    uint256 public winStart;
    mapping(uint32 => uint256) public bidIndex;

    constructor(
        address _admin,
        address _gateway,
        address _nftAddress,
        address _paymentRecipient,
        uint256 _auctionStartTime,
        uint256 _auctionEndTime,
        uint256 _unitPrice,
        uint256 _maxShare,
        uint256 _nftPrice,
        uint256 _nftAmount
    ) {
        require(
            _unitPrice >= _nftPrice,
            "DepositRaffleMinter: unitPrice must be larger than or equal to nftPrice"
        );
        require(
            _nftAmount > 0,
            "DepositRaffleMinter: nftAmount must be larger than zero"
        );

        _setupRole(DEFAULT_ADMIN_ROLE, _admin);
        _setupRole(MANAGER_ROLE, _admin);
        _setupRole(MANAGER_ROLE, msg.sender);

        gateway = _gateway;
        nftAddress = _nftAddress;
        paymentRecipient = _paymentRecipient;
        auctionStartTime = _auctionStartTime;
        auctionEndTime = _auctionEndTime;
        unitPrice = _unitPrice;
        nftPrice = _nftPrice;
        maxShare = _maxShare;
        nftAmount = _nftAmount;
    }

    receive() external payable {}

    /**************** Management Functions ****************/
    function sendPayment() external nonReentrant {
        require(
            block.timestamp > auctionEndTime && nftAmount > 0,
            "DepositRaffleMinter: payment can only be made after the auction has ended & nftAmount has been set"
        );
        require(!paymentSent, "DepositRaffleMinter: payment already sent");
        paymentSent = true;

        uint256 value = nftPrice * nftAmount;
        (bool success, ) = paymentRecipient.call{value: value}("");
        require(success, "DepositRaffleMinter: failed to send payment");
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
            block.timestamp < auctionEndTime,
            "DepositRaffleMinter: cannot change nftAmount once ended"
        );
        require(
            block.timestamp < auctionStartTime ||
                (_amt > 0 &&
                    (_amt < nftAmount || winStart + _amt <= bids.length)),
            "DepositRaffleMinter: nftAmount invalid"
        );
        nftAmount = _amt;
    }

    function setLimitForBuyerAmount(
        uint256 _amt
    ) external onlyRole(MANAGER_ROLE) {
        require(
            block.timestamp < auctionEndTime,
            "DepositRaffleMinter: limitForBuyerAmount can only be set before the auction end"
        );
        limitForBuyerAmount = _amt;
    }

    function setAuctionEndTime(uint256 _t) external onlyRole(MANAGER_ROLE) {
        require(_t > block.timestamp, "DepositRaffleMinter: invalid timestamp");
        auctionEndTime = _t;
    }

    function setAuctionStartTime(uint256 _t) external onlyRole(MANAGER_ROLE) {
        auctionStartTime = _t;
    }

    /**************** Core Functions ****************/
    function deposit(uint256 share) external payable nonReentrant {
        require(
            block.timestamp >= auctionStartTime &&
                block.timestamp <= auctionEndTime,
            "DepositRaffleMinter: deposit time invalid"
        );
        require(
            buyerBidCount[msg.sender] < limitForBuyerAmount,
            "DepositRaffleMinter: buyer limit exceeded"
        );

        require(
            msg.value == unitPrice * share && share > 0 && share <= maxShare,
            "DepositRaffleMinter: payment mismatch"
        );

        buyerBidCount[msg.sender] += 1;

        _idCounter += 1;
        Bid memory newBid = Bid(
            uint32(_idCounter),
            msg.sender,
            uint32(block.timestamp),
            uint32(share),
            unitPrice
        );
        userBids[msg.sender].push(newBid);

        uint256 oldBidsLength = bids.length;
        if (oldBidsLength < nftAmount) {
            bids.push(newBid);
            bidIndex[newBid.id] = oldBidsLength;
        } else {
            // shuffle newBid insertion position
            uint256 to = generateRandomInRange(
                0,
                oldBidsLength - 1,
                _idCounter
            );
            Bid memory temp = bids[to];
            bids[to] = newBid;
            bids.push(temp);

            // update bidIndex
            bidIndex[newBid.id] = to;
            bidIndex[temp.id] = oldBidsLength;

            // shuffle WinStart
            winStart = shuffleWinStart(oldBidsLength + 1, _idCounter);
        }

        emit Deposit(msg.sender, unitPrice, share);
    }

    function claimInfo(address _a) public view returns (ClaimInfo memory info) {
        require(
            block.timestamp > auctionEndTime,
            "DepositRaffleMinter: No claimInfo allowed until auction ends"
        );
        info.hasClaimed = hasClaimed[_a];
        info.refundAmount = 0;
        info.nftCount = 0;

        for (uint256 i = 0; i < userBids[_a].length; i++) {
            uint256 idx = bidIndex[userBids[_a][i].id];
            if (idx >= winStart && idx < winStart + nftAmount) {
                info.nftCount += 1;
                info.refundAmount +=
                    userBids[_a][i].price *
                    userBids[_a][i].share -
                    nftPrice;
            } else {
                info.refundAmount +=
                    userBids[_a][i].price *
                    userBids[_a][i].share;
            }
        }
    }

    function claimAndRefund() external nonReentrant {
        require(
            block.timestamp > auctionEndTime && nftAmount > 0,
            "DepositRaffleMinter: No claims or refunds allowed until auction ends & nftAmount has been set"
        );
        ClaimInfo memory info = claimInfo(msg.sender);

        require(!info.hasClaimed, "DepositRaffleMinter: has claimed");
        require(
            info.nftCount > 0 || info.refundAmount > 0,
            "DepositRaffleMinter: nothing to claim"
        );

        hasClaimed[msg.sender] = true;

        for (uint256 i = 0; i < info.nftCount; i++) {
            IGateway(gateway).ERC721_mint(nftAddress, msg.sender, 0);
        }
        if (info.refundAmount > 0) {
            (bool success, ) = msg.sender.call{value: info.refundAmount}("");
            require(success, "DepositRaffleMinter: failed to send refund");
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
    ) external view returns (Bid[][] memory _bids) {
        _bids = new Bid[][](_addresses.length);
        for (uint256 i = 0; i < _addresses.length; i++) {
            _bids[i] = userBids[_addresses[i]];
        }
    }

    function getTotalBidsCnt() external view returns (uint256) {
        return _idCounter;
    }

    function getBidAmtByBuyerId(
        address _buyer
    ) external view returns (uint256) {
        return buyerBidCount[_buyer];
    }

    function getWinnerBids(
        uint256 startIdx,
        uint256 batchSize
    ) public view returns (Bid[] memory) {
        require(
            block.timestamp > auctionEndTime,
            "DepositRaffleMinter: winnerBids not allowed until auction ends"
        );
        require(
            batchSize <= nftAmount,
            "DepositRaffleMinter: batchSize overflow"
        );
        uint256 resultSize = batchSize > nftAmount - startIdx
            ? nftAmount - startIdx
            : batchSize;
        Bid[] memory result = new Bid[](resultSize);
        for (uint256 i = 0; i < resultSize; i++) {
            result[i] = bids[winStart + startIdx + i];
        }
        return result;
    }

    /**************** View Helper Functions ****************/
    function generateRandomInRange(
        uint256 low,
        uint256 high,
        uint256 salt
    ) private view returns (uint256) {
        require(high > low, "high must be greater than low");
        uint256 randomNumber = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    block.timestamp,
                    salt
                )
            )
        );
        return (randomNumber % (high - low + 1)) + low;
    }

    function shuffleWinStart(
        uint256 maxAmount,
        uint256 salt
    ) private view returns (uint256) {
        if (maxAmount <= nftAmount) return 0;
        return generateRandomInRange(0, maxAmount - nftAmount, salt);
    }
}
