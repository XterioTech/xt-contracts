// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

abstract contract WhitelistClaim is AccessControl, ReentrancyGuard {
    bytes32 public merkleRoot;
    mapping(bytes32 => bool) public claimed;
    uint256 public deadline;

    event Claimed(address indexed account, uint256 amount);
    event Withdrawn(address indexed admin, uint256 amount);

    constructor(address admin, bytes32 _merkleRoot, uint256 _deadline) {
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
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
        return
            MerkleProof.verify(proof, merkleRoot, leaf) &&
            block.timestamp <= deadline;
    }

    function claim(
        address account,
        uint256 amount,
        bytes32[] memory proof
    ) external nonReentrant {
        require(
            isWhitelisted(account, amount, proof),
            "WhitelistClaim: Not whitelisted or after deadline"
        );

        bytes32 proofHash = keccak256(abi.encodePacked(account, amount, proof));
        require(!claimed[proofHash], "WhitelistClaim: Already claimed");
        claimed[proofHash] = true;

        _payOut(amount, account);

        emit Claimed(account, amount);
    }

    /// @dev This virtual function should transfer the specified `amount` of the payment token to the `to` address
    function _payOut(uint256 amount, address to) internal virtual;

    function _withdraw(address to) internal virtual;

    /****************** Admin Functions ******************/
    function withdraw(
        address to
    ) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(
            block.timestamp >= deadline,
            "WhitelistClaim: Cannot withdraw before or at deadline"
        );
        _withdraw(to);
    }

    function setDeadline(uint256 _t) external onlyRole(DEFAULT_ADMIN_ROLE) {
        deadline = _t;
    }
}
