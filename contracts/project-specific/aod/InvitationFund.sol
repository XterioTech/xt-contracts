// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "../../basic-tokens/interfaces/IGateway.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract InvitationFund is Ownable {
    using Math for uint256;
    using Address for address;

    event Invite(address indexed inviter, address indexed invitee);
    event Reward(address indexed inviter, uint256 value);

    address public gateway;

    address public scoreNFTAddress;

    address public mintableToken;

    // map from invitee to inviter
    mapping(address => address) private _inviter;

    // map from inviter to invitees
    mapping(address => address[]) private _invitees;

    // map from invitee to rewarded base value (mintableToken),
    // new reward can be harvest only when invitee holding more then this base value
    mapping(address => uint256) private _rewardedBase;

    // map from inviter to rewarded value (DAM)
    mapping(address => uint256) private _rewardedOf;

    uint256 public maxInviteesPerAddr = 50;

    // rewarding ratio (percent), 0.01BNB = 50 DAM, 1 BNB = 5000 DAM
    uint256 public rewardPercent = 500_000;

    uint256 public rewardedCnt;
    uint256 public rewardedTotalToken;

    uint256 public maxRewardedTotalToken;

    constructor(
        address _gateway,
        address _scoreNFTAddress,
        address _mintableTokenAddr
    ) {
        gateway = _gateway;
        scoreNFTAddress = _scoreNFTAddress;
        mintableToken = _mintableTokenAddr;
        maxRewardedTotalToken = 100 ether; // ToDo...
    }

    /** Handling Inviter Relations & Reward */
    function inviterOf(address invitee) public view returns (address) {
        return _inviter[invitee];
    }

    function inviteesOf(
        address inviter
    ) public view returns (address[] memory) {
        return _invitees[inviter];
    }

    function rewardedBaseFor(address invitee) public view returns (uint256) {
        return _rewardedBase[invitee];
    }

    // rewarded Token sent to the inviter
    function rewardedOf(address inviter) public view returns (uint256) {
        return _rewardedOf[inviter];
    }

    /********************************** Invite Functions ******************************************/

    function delegateInvite(address invitee, address inviter) public {
        require(invitee != address(0), "The invitee can't be zero address!");
        // require(!invitee.isContract(), "The invitee can't be contract!");
        require(
            !hasInviteeMintedScoreNFT(invitee),
            "The invitee already has minted ScoreNFT!"
        );
        require(
            _inviter[invitee] == address(0),
            "The invitee has been invited!"
        );
        require(invitee != inviter, "Cannot invite your self!");
        require(invitee != inviterOf(inviter), "Cannot invite your inviter!");
        require(
            _invitees[inviter].length < maxInviteesPerAddr,
            "Too many invitees!"
        );
        _inviter[invitee] = inviter;
        _invitees[inviter].push(invitee);

        emit Invite(inviter, invitee);
    }

    function delegateInviteBatch(
        address[] calldata invitees,
        address inviter
    ) external {
        require(
            (invitees.length + _invitees[inviter].length) <= maxInviteesPerAddr,
            "Too many invitees!"
        );
        for (uint256 i = 0; i < invitees.length; i++) {
            delegateInvite(invitees[i], inviter);
        }
    }

    function invite(address invitee) public {
        delegateInvite(invitee, msg.sender);
    }

    function inviteBatch(address[] calldata invitees) external {
        require(
            (invitees.length + _invitees[msg.sender].length) <=
                maxInviteesPerAddr,
            "Too many invitees!"
        );
        for (uint256 i = 0; i < invitees.length; i++) {
            invite(invitees[i]);
        }
    }

    /********************************** Calculate Reward Functions ******************************************/

    function calcRewardInTokenFor(
        address invitee
    ) public view returns (uint256) {
        uint256 balance = getInviteeTotalCost(invitee);
        uint256 base = rewardedBaseFor(invitee);
        return
            balance <= base ? 0 : (balance - base).mulDiv(rewardPercent, 100);
    }

    function calcRewardInToken(address inviter) public view returns (uint256) {
        uint256 sum;
        for (uint256 i = 0; i < _invitees[inviter].length; i++) {
            address son = _invitees[inviter][i];
            sum += calcRewardInTokenFor(son);
        }
        return sum;
    }

    /********************************** Get Reward Functions ******************************************/

    function _sendReward(address inviter, uint256 tokenAmount) private {
        rewardedTotalToken += tokenAmount;
        require(rewardedTotalToken < maxRewardedTotalToken, "TOTAL_LIMIT");

        IGateway(gateway).ERC20_mint(mintableToken, msg.sender, tokenAmount);

        _rewardedOf[inviter] += tokenAmount;
        rewardedCnt += 1;
        rewardedTotalToken += tokenAmount;
        emit Reward(inviter, tokenAmount);
    }

    function _calcRewardAndUpdateBase(
        address invitee
    ) private returns (uint256) {
        uint256 balance = getInviteeTotalCost(invitee);
        uint256 base = _rewardedBase[invitee];
        if (balance <= base) return 0;
        _rewardedBase[invitee] = balance;
        return (balance - base).mulDiv(rewardPercent, 100);
    }

    function getRewardFor(address invitee) public {
        address inviter = inviterOf(invitee);
        require(inviter == msg.sender, "Only the inviter can get reward!");
        uint256 reward = _calcRewardAndUpdateBase(invitee);
        require(reward > 0, "No reward available!");
        _sendReward(inviter, reward);
    }

    function getReward() public {
        address inviter = msg.sender;
        uint256 reward;
        for (uint256 i = 0; i < _invitees[inviter].length; i++) {
            reward += _calcRewardAndUpdateBase(_invitees[inviter][i]);
        }
        require(reward > 0, "No reward available!");
        _sendReward(inviter, reward);
    }

    /** Handling Funds & Settings */
    function remainingToken() public view returns (uint256) {
        return
            maxRewardedTotalToken > rewardedTotalToken
                ? maxRewardedTotalToken - rewardedTotalToken
                : 0;
    }

    function setRewardPercent(uint256 newPct) public onlyOwner {
        require(newPct <= 100);
        rewardPercent = newPct;
    }

    function setMaxInviteesPerAddr(uint256 cnt) public onlyOwner {
        maxInviteesPerAddr = cnt;
    }

    function setMaxRewardedTotalToken(uint256 amount) public onlyOwner {
        maxRewardedTotalToken = amount;
    }

    function setScoreNFTAddress(address _addr) public onlyOwner {
        scoreNFTAddress = _addr;
    }

    /********************************** Internal Query ScoreNFT Functions ******************************************/
    function getInviteeTotalCost(
        address invitee
    ) internal view returns (uint256 total) {
        (bool success, bytes memory result) = scoreNFTAddress.staticcall(
            abi.encodeWithSignature("minterTotalCost(address)", invitee)
        );
        if (success && result.length >= 32) {
            total = abi.decode(result, (uint256));
        }
    }

    function hasInviteeMintedScoreNFT(
        address invitee
    ) internal view returns (bool) {
        (bool success, bytes memory result) = scoreNFTAddress.staticcall(
            abi.encodeWithSignature("balanceOf(address)", invitee)
        );
        uint256 balance = 0;
        if (success && result.length >= 32) {
            balance = abi.decode(result, (uint256));
        }
        return balance > 0;
    }
}
