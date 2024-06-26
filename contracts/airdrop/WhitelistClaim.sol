// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract WhitelistClaim is Ownable, ReentrancyGuard {
    bytes32 public merkleRoot;
    mapping(address => bool) public claimed;
    uint256 public startTime;
    uint256 public deadline;

    event XClaim(address indexed account, uint256 amount);
    event UpdateMerkleRoot(bytes32 newMerkleRoot);

    constructor(bytes32 _merkleRoot, uint256 _startTime, uint256 _deadline) {
        merkleRoot = _merkleRoot;
        startTime = _startTime;
        deadline = _deadline;
    }

    receive() external payable {}

    function isWhitelisted(
        address account,
        uint256 amount,
        bytes32[] memory proof
    ) public view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(account, amount));
        return MerkleProof.verify(proof, merkleRoot, leaf);
    }

    function claim(
        uint256 amount,
        bytes32[] memory proof
    ) external nonReentrant {
        require(
            block.timestamp >= startTime,
            "WhitelistClaim: claiming has not started yet"
        );
        require(
            block.timestamp <= deadline,
            "WhitelistClaim: deadline exceeded"
        );
        require(
            isWhitelisted(msg.sender, amount, proof),
            "WhitelistClaim: not whitelisted"
        );
        require(!claimed[msg.sender], "WhitelistClaim: already claimed");
        claimed[msg.sender] = true;

        _payOut(amount, msg.sender);

        emit XClaim(msg.sender, amount);
    }

    /// @dev This virtual function should transfer the specified `amount` of the payment token to the `to` address
    function _payOut(uint256 amount, address to) internal virtual;

    function _withdraw(address to) internal virtual;

    /****************** Admin Functions ******************/
    function withdraw(address to) external onlyOwner nonReentrant {
        _withdraw(to);
    }

    function updateMerkleRoot(bytes32 newMerkleRoot) external onlyOwner {
        merkleRoot = newMerkleRoot;
        emit UpdateMerkleRoot(newMerkleRoot);
    }

    function updateDeadline(uint256 _t) external onlyOwner {
        deadline = _t;
    }

    function updateStartTime(uint256 _t) external onlyOwner {
        startTime = _t;
    }

    /****************** View Functions ******************/
    function isTimeValid() external view returns (bool) {
        return block.timestamp >= startTime && block.timestamp <= deadline;
    }
}
