// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract WhitelistClaim is Ownable, ReentrancyGuard {
    bytes32 public merkleRoot;
    mapping(bytes32 => bool) public claimed;
    uint256 public deadline;

    event Claimed(address indexed account, uint256 amount);
    event MerkleRootUpdated(bytes32 newMerkleRoot);

    constructor(bytes32 _merkleRoot, uint256 _deadline) {
        merkleRoot = _merkleRoot;
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
        address account,
        uint256 amount,
        bytes32[] memory proof
    ) external nonReentrant {
        require(
            block.timestamp <= deadline,
            "WhitelistClaim: deadline exceeded"
        );
        require(
            isWhitelisted(account, amount, proof),
            "WhitelistClaim: not whitelisted"
        );

        bytes32 proofHash = keccak256(abi.encodePacked(account, amount, proof));
        require(!claimed[proofHash], "WhitelistClaim: already claimed");
        claimed[proofHash] = true;

        _payOut(amount, account);

        emit Claimed(account, amount);
    }

    /// @dev This virtual function should transfer the specified `amount` of the payment token to the `to` address
    function _payOut(uint256 amount, address to) internal virtual;

    function _withdraw(address to) internal virtual;

    /****************** Admin Functions ******************/
    function withdraw(address to) external onlyOwner nonReentrant {
        require(
            block.timestamp >= deadline,
            "WhitelistClaim: cannot withdraw before or at deadline"
        );
        _withdraw(to);
    }

    function updateMerkleRoot(bytes32 newMerkleRoot) external onlyOwner {
        merkleRoot = newMerkleRoot;
        emit MerkleRootUpdated(newMerkleRoot);
    }

    function setDeadline(uint256 _t) external onlyOwner {
        deadline = _t;
    }
}
