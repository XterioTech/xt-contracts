// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";

abstract contract WhitelistClaimWithUnlockTime is Ownable, ReentrancyGuard {
    bytes32 public merkleRoot;
    mapping(address => mapping(uint256 => bool)) public claimed;
    uint256 public startTime;
    uint256 public deadline;

    event XClaim(address indexed account, uint256 amount, uint256 unlockTime);
    event XDelegateClaim(
        address indexed delegator,
        address indexed account,
        uint256 amount,
        uint256 unlockTime
    );
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
        uint256 unlockTime,
        bytes32[] memory proof
    ) public view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(account, amount, unlockTime));
        return MerkleProof.verify(proof, merkleRoot, leaf);
    }

    modifier validateClaim(
        address account,
        uint256 amount,
        uint256 unlockTime,
        bytes32[] memory proof
    ) {
        require(
            block.timestamp >= startTime,
            "WhitelistClaim: claiming has not started yet"
        );
        require(
            block.timestamp <= deadline,
            "WhitelistClaim: deadline exceeded"
        );
        require(
            block.timestamp >= unlockTime,
            "WhitelistClaim: unlockTime has not arrived yet"
        );
        require(
            isWhitelisted(account, amount, unlockTime, proof),
            "WhitelistClaim: not whitelisted"
        );
        require(
            !claimed[account][unlockTime],
            "WhitelistClaim: already claimed"
        );
        claimed[account][unlockTime] = true;
        _;
    }

    function claim(
        uint256 amount,
        uint256 unlockTime,
        bytes32[] memory proof
    )
        external
        nonReentrant
        validateClaim(msg.sender, amount, unlockTime, proof)
    {
        _payOut(amount, msg.sender);
        emit XClaim(msg.sender, amount, unlockTime);
    }

    function delegateClaim(
        address beneficiary,
        uint256 amount,
        uint256 unlockTime,
        bytes32[] memory proof,
        uint256 _deadline,
        bytes calldata sig
    )
        external
        nonReentrant
        validateClaim(beneficiary, amount, unlockTime, proof)
    {
        require(block.timestamp <= _deadline, "WhitelistClaim: too late");

        bytes32 hash = keccak256(
            abi.encodePacked(
                beneficiary,
                amount,
                unlockTime,
                proof,
                _deadline,
                block.chainid,
                msg.sender, // delegator
                address(this)
            )
        );

        // beneficiary must be the signer
        if (isContract(beneficiary)) {
            require(
                IERC1271(beneficiary).isValidSignature(hash, sig) ==
                    bytes4(0x1626ba7e),
                "WhitelistClaim: invalid signature"
            );
        } else {
            require(
                beneficiary ==
                    ECDSA.recover(ECDSA.toEthSignedMessageHash(hash), sig),
                "WhitelistClaim: invalid signature"
            );
        }

        _payOut(amount, msg.sender); // _payout to delegator for part staking
        emit XDelegateClaim(msg.sender, beneficiary, amount, unlockTime);
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

    function isContract(address account) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(account)
        }
        return size > 0;
    }
}
